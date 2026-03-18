"""
Prediction service — day-of-week × hour-of-day medians.

Uses AT TIME ZONE to group historical observations by local hour,
so predictions reflect when people actually cross, not UTC artifacts.
"""
import numpy as np
import structlog
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo
from sqlalchemy import select, func, and_, text
from app.database import AsyncSessionLocal
from app.models.observation import WaitTimeObservation
from app.models.prediction import Prediction
from app.models.port import PortOfEntry, LaneType
from app.schemas.prediction import HourlyPrediction, BestTimeSuggestion, PredictionResponse
from app.services.cache import get_cached_predictions, cache_predictions, get_live_wait

logger = structlog.get_logger()

MIN_SAMPLES_MEDIUM = 7
MIN_SAMPLES_HIGH = 30


def compute_confidence(sample_count: int, iqr: float) -> str:
    if sample_count < MIN_SAMPLES_MEDIUM:
        return "low"
    if sample_count < MIN_SAMPLES_HIGH:
        return "medium"
    if iqr > 60:
        return "medium"
    return "high"


async def compute_historical_stats(
    port_id: int,
    lane_type_id: int,
    day_of_week: int,
    hour: int,
    tz: str,
    lookback_days: int = 90,
) -> Optional[dict]:
    """Compute median/IQR for a port+lane+dow+hour, using local timezone for grouping."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    async with AsyncSessionLocal() as session:
        # Use AT TIME ZONE so we group by local hour, not UTC
        local_ts = text(f"observed_at AT TIME ZONE '{tz}'")
        result = await session.execute(
            select(WaitTimeObservation.wait_minutes).where(
                and_(
                    WaitTimeObservation.port_id == port_id,
                    WaitTimeObservation.lane_type_id == lane_type_id,
                    WaitTimeObservation.wait_minutes.isnot(None),
                    WaitTimeObservation.is_closed == False,
                    WaitTimeObservation.observed_at >= cutoff,
                    text(f"extract(dow from observed_at AT TIME ZONE '{tz}') = :dow"),
                    text(f"extract(hour from observed_at AT TIME ZONE '{tz}') = :hour"),
                )
            ).params(dow=day_of_week, hour=hour)
        )
        waits = [row[0] for row in result.all()]

    if not waits:
        return None

    arr = np.array(waits, dtype=float)
    return {
        "median": float(np.median(arr)),
        "p25": float(np.percentile(arr, 25)),
        "p75": float(np.percentile(arr, 75)),
        "sample_count": len(waits),
        "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
    }


async def generate_predictions_for_date(
    port_id: int,
    lane_type_id: int,
    target_date: date,
    tz: str,
) -> list[dict]:
    """Generate hourly predictions for a date, grouping by local timezone hour."""
    dow = target_date.weekday()
    # Python weekday: Mon=0..Sun=6 → PostgreSQL DOW: Sun=0..Sat=6
    pg_dow = (dow + 1) % 7

    predictions = []
    for hour in range(24):
        stats = await compute_historical_stats(port_id, lane_type_id, pg_dow, hour, tz)
        if stats is None:
            continue

        confidence = compute_confidence(stats["sample_count"], stats["iqr"])
        predictions.append({
            "port_id": port_id,
            "lane_type_id": lane_type_id,
            "prediction_date": target_date,
            "hour": hour,
            "predicted_wait": round(stats["median"], 1),
            "confidence": confidence,
            "p25_wait": round(stats["p25"], 1),
            "p75_wait": round(stats["p75"], 1),
            "sample_count": stats["sample_count"],
        })

    return predictions


async def store_predictions(predictions: list[dict]):
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
    """Nightly job: generate predictions for each port using its local timezone."""
    log = logger.bind(service="prediction")
    log.info("prediction_generation_started")

    async with AsyncSessionLocal() as session:
        ports_result = await session.execute(
            select(PortOfEntry.id, PortOfEntry.timezone).where(PortOfEntry.is_active == True)
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
            for target_date in [today, tomorrow]:
                preds = await generate_predictions_for_date(port_id, lane_id, target_date, tz)
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

    # Include timezone in cache key so different tz requests aren't mixed
    cache_key_tz = tz.replace("/", "_")
    cached = await get_cached_predictions(port_id, lane_type_id, f"{date_str}:{cache_key_tz}")
    if cached:
        return PredictionResponse(**cached)

    # Compute on the fly using the requested timezone
    preds = await generate_predictions_for_date(port_id, lane_type_id, target_date, tz)

    hourly = [
        HourlyPrediction(
            hour=p["hour"],
            predictedWait=float(p["predicted_wait"]),
            p25Wait=float(p["p25_wait"]) if p["p25_wait"] else None,
            p75Wait=float(p["p75_wait"]) if p["p75_wait"] else None,
            confidence=p["confidence"],
            sampleCount=p["sample_count"] or 0,
        )
        for p in preds
    ]

    best_time = await compute_best_time(port_id, lane_type_id, hourly, tz)

    response = PredictionResponse(
        portId=port_id,
        laneTypeId=lane_type_id,
        date=date_str,
        hourly=hourly,
        bestTime=best_time,
    )

    await cache_predictions(port_id, lane_type_id, f"{date_str}:{cache_key_tz}", response.model_dump())
    return response


async def compute_best_time(
    port_id: int,
    lane_type_id: int,
    hourly: list[HourlyPrediction],
    tz: str = "America/Tijuana",
) -> Optional[BestTimeSuggestion]:
    if not hourly:
        return BestTimeSuggestion(
            message="Insufficient data to suggest a best time.",
            confidence="low",
        )

    # Get current hour in the user's timezone
    try:
        now_local = datetime.now(ZoneInfo(tz))
        now_hour = now_local.hour
    except Exception:
        now_hour = datetime.now(timezone.utc).hour

    future_hours = [h for h in hourly if h.hour >= now_hour]

    if not future_hours:
        return BestTimeSuggestion(
            message="No predictions available for remaining hours today.",
            confidence="low",
        )

    best = min(future_hours, key=lambda h: h.predictedWait)

    live = await get_live_wait(port_id, lane_type_id)
    current_wait = live.get("waitMinutes") if live else None

    if current_wait is not None and best.predictedWait >= current_wait:
        return BestTimeSuggestion(
            bestHour=best.hour,
            bestWait=best.predictedWait,
            currentWait=current_wait,
            message=f"Current wait ({current_wait} min) is already near the day's best. Now is a good time to cross.",
            confidence=best.confidence,
        )

    hour_label = f"{best.hour}:00" if best.hour >= 10 else f"0{best.hour}:00"

    if current_wait is not None:
        savings = current_wait - best.predictedWait
        if savings > 15:
            return BestTimeSuggestion(
                bestHour=best.hour,
                bestWait=best.predictedWait,
                currentWait=current_wait,
                message=f"Typically lower around {hour_label} (~{best.predictedWait:.0f} min). Could save ~{savings:.0f} min.",
                confidence=best.confidence,
            )

    return BestTimeSuggestion(
        bestHour=best.hour,
        bestWait=best.predictedWait,
        currentWait=current_wait,
        message=f"Typically lowest around {hour_label} (~{best.predictedWait:.0f} min).",
        confidence=best.confidence,
    )
