"""
Prediction service.

Compared to the original (dow, hour) cell-median approach this version:
  - fetches all observations for a (port, lane) once and smooths in Python
    instead of running 24 SQL queries per date,
  - pools data across neighboring hours and weekdays via a Gaussian kernel,
  - downweights old observations with a 21-day half-life,
  - winsorizes wait times so a stray 4-hour spike doesn't poison the median,
  - flags border holidays and downweights cross-holiday/non-holiday data,
  - blends today's live wait into the next few hours of predictions.

Public surface (used by API + scheduler) is unchanged:
  run_daily_predictions(), generate_predictions_for_date(),
  get_predictions_for_port(), compute_confidence().
"""
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy import and_, select, text

from app.database import AsyncSessionLocal
from app.models.observation import WaitTimeObservation
from app.models.port import LaneType, PortOfEntry
from app.schemas.prediction import (
    BestTimeSuggestion,
    HourlyPrediction,
    PredictionResponse,
)
from app.services.cache import (
    cache_predictions,
    get_cached_predictions,
    get_live_wait,
)
from app.services.prediction_model import (
    apply_nowcast,
    is_border_holiday,
    smooth_predictions,
)

logger = structlog.get_logger()

LOOKBACK_DAYS = 90

# Retained for backwards compatibility with existing tests / callers.
MIN_SAMPLES_MEDIUM = 7
MIN_SAMPLES_HIGH = 30


def compute_confidence(sample_count: int, iqr: float) -> str:
    """Legacy confidence rule kept for API stability and existing tests.

    The smoothed predictor uses compute_confidence_smoothed from
    prediction_model.py instead, which is based on effective sample size.
    """
    if sample_count < MIN_SAMPLES_MEDIUM:
        return "low"
    if sample_count < MIN_SAMPLES_HIGH:
        return "medium"
    if iqr > 60:
        return "medium"
    return "high"


async def _fetch_observations(
    port_id: int, lane_type_id: int, lookback_days: int = LOOKBACK_DAYS
) -> list[tuple[datetime, int]]:
    """All non-closed, non-null observations in the lookback window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(
                WaitTimeObservation.observed_at,
                WaitTimeObservation.wait_minutes,
            ).where(
                and_(
                    WaitTimeObservation.port_id == port_id,
                    WaitTimeObservation.lane_type_id == lane_type_id,
                    WaitTimeObservation.wait_minutes.isnot(None),
                    WaitTimeObservation.is_closed == False,  # noqa: E712
                    WaitTimeObservation.observed_at >= cutoff,
                )
            )
        )
        return [(row[0], int(row[1])) for row in result.all()]


def _to_local_naive(
    observations: list[tuple[datetime, int]], tz: ZoneInfo
) -> list[tuple[datetime, int]]:
    """Convert UTC-aware observations to tz-naive datetimes in the local zone."""
    out = []
    for dt, wait in observations:
        if dt.tzinfo is None:
            local = dt.replace(tzinfo=timezone.utc).astimezone(tz)
        else:
            local = dt.astimezone(tz)
        out.append((local.replace(tzinfo=None), wait))
    return out


async def generate_predictions_for_date(
    port_id: int,
    lane_type_id: int,
    target_date: date,
    tz: str,
) -> list[dict]:
    """Generate 24 hourly baseline predictions (no live nowcast applied)."""
    try:
        zinfo = ZoneInfo(tz)
    except Exception:
        zinfo = ZoneInfo("America/Tijuana")

    observations = await _fetch_observations(port_id, lane_type_id)
    if not observations:
        return []

    local_obs = _to_local_naive(observations, zinfo)
    now_local = datetime.now(zinfo).replace(tzinfo=None)
    is_hol = is_border_holiday(target_date)

    preds = smooth_predictions(local_obs, target_date, now_local, is_hol)

    return [
        {
            "port_id": port_id,
            "lane_type_id": lane_type_id,
            "prediction_date": target_date,
            **p,
        }
        for p in preds
    ]


async def store_predictions(predictions: list[dict]):
    """Persist predictions to the predictions table. Extra dict keys are ignored."""
    if not predictions:
        return

    async with AsyncSessionLocal() as session:
        for pred in predictions:
            stmt = text("""
                INSERT INTO predictions (port_id, lane_type_id, prediction_date, hour,
                    predicted_wait, confidence, p25_wait, p75_wait, sample_count, computed_at)
                VALUES (:port_id, :lane_type_id, :prediction_date, :hour,
                    :predicted_wait, :confidence, :p25_wait, :p75_wait, :sample_count, NOW())
                ON CONFLICT (port_id, lane_type_id, prediction_date, hour)
                DO UPDATE SET
                    predicted_wait = EXCLUDED.predicted_wait,
                    confidence = EXCLUDED.confidence,
                    p25_wait = EXCLUDED.p25_wait,
                    p75_wait = EXCLUDED.p75_wait,
                    sample_count = EXCLUDED.sample_count,
                    computed_at = NOW()
            """)
            await session.execute(stmt, pred)
        await session.commit()


async def run_daily_predictions():
    """Nightly job: generate baseline (non-nowcasted) predictions for each port."""
    log = logger.bind(service="prediction")
    log.info("prediction_generation_started")

    async with AsyncSessionLocal() as session:
        ports_result = await session.execute(
            select(PortOfEntry.id, PortOfEntry.timezone).where(
                PortOfEntry.is_active == True  # noqa: E712
            )
        )
        ports = [(row[0], row[1]) for row in ports_result.all()]

        lanes = await session.execute(select(LaneType.id))
        lane_ids = [row[0] for row in lanes.all()]

    today = date.today()
    tomorrow = today + timedelta(days=1)
    total = 0

    for port_id, port_tz in ports:
        tz = port_tz or "America/Tijuana"
        for lane_id in lane_ids:
            for target_date in (today, tomorrow):
                preds = await generate_predictions_for_date(
                    port_id, lane_id, target_date, tz
                )
                await store_predictions(preds)
                total += len(preds)

    log.info("prediction_generation_complete", total_predictions=total)


async def get_predictions_for_port(
    port_id: int,
    lane_type_id: int,
    target_date: Optional[date] = None,
    tz: str = "America/Tijuana",
) -> PredictionResponse:
    if target_date is None:
        target_date = date.today()

    date_str = target_date.isoformat()
    cache_key_tz = tz.replace("/", "_")
    cached = await get_cached_predictions(
        port_id, lane_type_id, f"{date_str}:{cache_key_tz}"
    )
    if cached:
        return PredictionResponse(**cached)

    preds = await generate_predictions_for_date(port_id, lane_type_id, target_date, tz)

    # Live nowcast — only meaningful for "today" in the requested zone.
    try:
        zinfo = ZoneInfo(tz)
    except Exception:
        zinfo = ZoneInfo("America/Tijuana")
    today_local = datetime.now(zinfo).date()

    live = await get_live_wait(port_id, lane_type_id)
    live_wait = live.get("waitMinutes") if live else None

    if target_date == today_local and live_wait is not None:
        now_hour = datetime.now(zinfo).hour
        preds = apply_nowcast(preds, now_hour, float(live_wait))

    hourly = [
        HourlyPrediction(
            hour=p["hour"],
            predictedWait=float(p["predicted_wait"]),
            p25Wait=float(p["p25_wait"]) if p["p25_wait"] is not None else None,
            p75Wait=float(p["p75_wait"]) if p["p75_wait"] is not None else None,
            confidence=p["confidence"],
            sampleCount=p.get("sample_count", 0) or 0,
            nEff=p.get("n_eff"),
            nowcasted=p.get("nowcasted"),
        )
        for p in preds
    ]

    is_hol = is_border_holiday(target_date)
    best_time = await compute_best_time(port_id, lane_type_id, hourly, tz, live_wait)

    response = PredictionResponse(
        portId=port_id,
        laneTypeId=lane_type_id,
        date=date_str,
        hourly=hourly,
        bestTime=best_time,
        isHoliday=is_hol,
    )

    await cache_predictions(
        port_id,
        lane_type_id,
        f"{date_str}:{cache_key_tz}",
        response.model_dump(),
    )
    return response


async def compute_best_time(
    port_id: int,
    lane_type_id: int,
    hourly: list[HourlyPrediction],
    tz: str = "America/Tijuana",
    current_wait: Optional[int] = None,
) -> Optional[BestTimeSuggestion]:
    if not hourly:
        return BestTimeSuggestion(
            message="Insufficient data to suggest a best time.",
            confidence="low",
        )

    try:
        now_hour = datetime.now(ZoneInfo(tz)).hour
    except Exception:
        now_hour = datetime.now(timezone.utc).hour

    future_hours = [h for h in hourly if h.hour >= now_hour]
    if not future_hours:
        return BestTimeSuggestion(
            message="No predictions available for remaining hours today.",
            confidence="low",
        )

    best = min(future_hours, key=lambda h: h.predictedWait)

    if current_wait is None:
        live = await get_live_wait(port_id, lane_type_id)
        current_wait = live.get("waitMinutes") if live else None

    h = best.hour
    if h == 0:
        hour_label = "12 AM"
    elif h < 12:
        hour_label = f"{h} AM"
    elif h == 12:
        hour_label = "12 PM"
    else:
        hour_label = f"{h - 12} PM"

    best_wait = best.predictedWait

    if current_wait is not None:
        savings = current_wait - best_wait
        if savings > 10:
            msg = (
                f"Typically lower around {hour_label} (~{best_wait:.0f} min). "
                f"Could save ~{savings:.0f} min vs. current {current_wait} min."
            )
        elif best_wait <= current_wait:
            if best_wait > 60:
                msg = f"Wait times stay high today. Lowest expected around {hour_label} (~{best_wait:.0f} min)."
            elif best_wait > 30:
                msg = f"Moderate waits expected all day. Lowest around {hour_label} (~{best_wait:.0f} min)."
            else:
                msg = f"Current wait ({current_wait} min) is already near today's best."
        else:
            if current_wait <= 15:
                msg = "Now is one of the better times — waits typically rise later today."
            else:
                msg = f"Waits expected to stay around {best_wait:.0f}+ min. Lowest around {hour_label}."
    else:
        if best_wait > 60:
            msg = f"Expect long waits today. Lowest typically around {hour_label} (~{best_wait:.0f} min)."
        else:
            msg = f"Typically lowest around {hour_label} (~{best_wait:.0f} min)."

    return BestTimeSuggestion(
        bestHour=best.hour,
        bestWait=best_wait,
        currentWait=current_wait,
        message=msg,
        confidence=best.confidence,
    )
