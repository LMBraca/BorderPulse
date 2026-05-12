"""
Pure-function prediction model: kernel smoothing, recency weighting,
weighted quantiles, holiday detection, and live nowcasting blend.

Separated from prediction.py so the math is independently testable and
free of DB / Redis dependencies.

Algorithm sketch
----------------
For each (target_date, hour) cell we compute a weighted median over all
observations in the lookback window. Each observation's weight is:

    w = recency × dow_affinity × hour_affinity × holiday_match

- recency: exp(-ln 2 · age_days / HALF_LIFE_DAYS). 21-day half-life so
  patterns from a month ago count, patterns from 90 days ago barely do.
- hour_affinity: Gaussian over cyclic hour distance (σ = 1h). Hour 22
  pulls some weight from hours 21 and 23 (and a little from 0).
- dow_affinity: same dow = 1.0; adjacent days in same weekday/weekend
  group = 0.45; same group but further = 0.18; cross-group = 0.07.
  This is the key fix for sparse data — a Tuesday cell borrows from
  Mon/Wed/Thu more than from Saturday.
- holiday_match: 1.0 if observation's date and target date are both
  holidays or both not; 0.3 otherwise (we'd rather use other holidays'
  data when forecasting a holiday).

Confidence is from the effective sample size (Kish formula) and the IQR
relative to the prediction; holiday targets get bumped down one notch.
"""
import math
from datetime import date, datetime, timedelta
from typing import Optional

import numpy as np


# --- Tunables -----------------------------------------------------------

HALF_LIFE_DAYS = 21.0
HOUR_BANDWIDTH = 1.0  # σ for Gaussian over cyclic hour distance

DOW_SAME = 1.0
DOW_ADJ_SAME_GROUP = 0.45
DOW_FAR_SAME_GROUP = 0.18
DOW_CROSS_GROUP = 0.07

HOLIDAY_MISMATCH_WEIGHT = 0.3

MAX_WAIT_CLIP_MIN = 240  # 4h — guard against CBP reporting glitches

# Live "nowcast" — bias the next few hours toward today's deviation
NOWCAST_HORIZON_HOURS = 3
NOWCAST_DECAY_HOURS = 1.5
NOWCAST_MIN_DELTA_MIN = 5.0

MIN_WEIGHT_KEEP = 1e-4

# Effective-sample-size thresholds for confidence labelling.
# Calibrated against prod (~7.7k obs / port / lane, n_eff routinely 300+
# at any hour) and local (~80 obs / port / lane, n_eff ~3-22). With these
# thresholds, dense data earns "high"; sparse data caps at "medium".
CONF_LOW_NEFF = 4.0
CONF_HIGH_NEFF = 30.0

# IQR / predicted ratio above which a cell is demoted from "high" to
# "medium". Floor of 45 minutes accounts for natural overnight variance
# (median wait 35, IQR 50 is normal, not noise).
IQR_INSTABILITY_FLOOR = 45.0
IQR_INSTABILITY_RATIO = 1.5


# --- Kernels ------------------------------------------------------------

def cyclic_hour_distance(h1: int, h2: int) -> int:
    d = abs(h1 - h2) % 24
    return min(d, 24 - d)


def hour_kernel(target_hour: int, sample_hour: int, sigma: float = HOUR_BANDWIDTH) -> float:
    d = cyclic_hour_distance(target_hour, sample_hour)
    return math.exp(-0.5 * (d / sigma) ** 2)


def _is_weekend(dow: int) -> bool:
    # Python weekday: Mon=0..Sun=6
    return dow in (5, 6)


def dow_kernel(target_dow: int, sample_dow: int) -> float:
    if target_dow == sample_dow:
        return DOW_SAME
    same_group = _is_weekend(target_dow) == _is_weekend(sample_dow)
    d = abs(target_dow - sample_dow) % 7
    d = min(d, 7 - d)
    if same_group:
        return DOW_ADJ_SAME_GROUP if d == 1 else DOW_FAR_SAME_GROUP
    return DOW_CROSS_GROUP


def recency_weight(age_days: float, half_life: float = HALF_LIFE_DAYS) -> float:
    if age_days <= 0:
        return 1.0
    return math.exp(-math.log(2) * age_days / half_life)


# --- Weighted statistics ------------------------------------------------

def weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    """Lower-CDF weighted quantile; values can be unsorted."""
    if values.size == 0:
        return float("nan")
    order = np.argsort(values)
    v = values[order]
    w = weights[order]
    cumw = np.cumsum(w)
    total = float(cumw[-1])
    if total <= 0:
        return float("nan")
    target = q * total
    idx = int(np.searchsorted(cumw, target, side="left"))
    idx = min(idx, v.size - 1)
    return float(v[idx])


def effective_sample_size(weights: np.ndarray) -> float:
    """Kish's effective sample size: (Σw)² / Σ(w²)."""
    if weights.size == 0:
        return 0.0
    s1 = float(weights.sum())
    s2 = float((weights * weights).sum())
    if s2 <= 0:
        return 0.0
    return s1 * s1 / s2


def compute_confidence_smoothed(
    n_eff: float, iqr: float, predicted: float, is_holiday: bool
) -> str:
    """Confidence from effective sample size + dispersion.

    Holidays demote "high" to "medium" but don't compound with already-low
    data quality — the response also carries an isHoliday flag for the UI.
    """
    if n_eff < CONF_LOW_NEFF:
        base = "low"
    elif n_eff < CONF_HIGH_NEFF:
        base = "medium"
    else:
        base = "high"

    unstable = iqr > max(IQR_INSTABILITY_FLOOR, IQR_INSTABILITY_RATIO * max(predicted, 1.0))
    if base == "high" and unstable:
        base = "medium"

    if is_holiday and base == "high":
        base = "medium"
    return base


# --- Holidays -----------------------------------------------------------

def easter_sunday(year: int) -> date:
    """Anonymous Gregorian algorithm — Meeus / Butcher."""
    a = year % 19
    b = year // 100
    c = year % 100
    d_ = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d_ - g + 15) % 30
    i = c // 4
    k = c % 4
    L = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * L) // 451
    month = (h + L - 7 * m + 114) // 31
    day = ((h + L - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    d = date(year, month, 1)
    offset = (weekday - d.weekday()) % 7
    return d + timedelta(days=offset + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    if month == 12:
        nm = date(year + 1, 1, 1)
    else:
        nm = date(year, month + 1, 1)
    last = nm - timedelta(days=1)
    offset = (last.weekday() - weekday) % 7
    return last - timedelta(days=offset)


def border_holidays(year: int) -> set[date]:
    """Dates with materially different US-MX border traffic patterns."""
    h: set[date] = set()
    # US federal + heavy-travel
    h.add(date(year, 1, 1))                       # New Year
    h.add(_nth_weekday(year, 1, 0, 3))            # MLK
    h.add(_nth_weekday(year, 2, 0, 3))            # Presidents Day
    h.add(_last_weekday(year, 5, 0))              # Memorial Day
    h.add(date(year, 7, 4))                       # Independence Day
    h.add(_nth_weekday(year, 9, 0, 1))            # Labor Day
    thx = _nth_weekday(year, 11, 3, 4)            # Thanksgiving
    h.add(thx)
    h.add(thx + timedelta(days=1))                # Black Friday
    h.add(date(year, 12, 24))
    h.add(date(year, 12, 25))
    h.add(date(year, 12, 31))
    # Mexico federal + heavy-travel
    h.add(date(year, 2, 5))                       # Constitución
    h.add(_nth_weekday(year, 2, 0, 1))            # Constitución (observed)
    h.add(date(year, 3, 21))                      # Benito Juárez
    h.add(_nth_weekday(year, 3, 0, 3))            # Benito Juárez (observed)
    h.add(date(year, 5, 1))                       # Día del Trabajo
    h.add(date(year, 5, 5))                       # Cinco de Mayo
    h.add(date(year, 9, 16))                      # Independencia
    h.add(date(year, 11, 1))                      # Día de Muertos
    h.add(date(year, 11, 2))
    h.add(date(year, 11, 20))                     # Revolución
    h.add(_nth_weekday(year, 11, 0, 3))           # Revolución (observed)
    # Semana Santa: Maundy Thursday → Easter Sunday
    e = easter_sunday(year)
    for off in (-3, -2, -1, 0):
        h.add(e + timedelta(days=off))
    return h


_HOLIDAY_CACHE: dict[int, set[date]] = {}


def is_border_holiday(d: date) -> bool:
    if d.year not in _HOLIDAY_CACHE:
        _HOLIDAY_CACHE[d.year] = border_holidays(d.year)
    return d in _HOLIDAY_CACHE[d.year]


# --- Main smoothing -----------------------------------------------------

def smooth_predictions(
    observations: list[tuple[datetime, int]],
    target_date: date,
    now_local: datetime,
    is_holiday: bool,
) -> list[dict]:
    """Compute 24 hourly predictions from observations (local-naive dt, wait_min)."""
    if not observations:
        return []

    waits = np.clip(
        np.array([o[1] for o in observations], dtype=float),
        0.0,
        MAX_WAIT_CLIP_MIN,
    )
    local_dts = [o[0] for o in observations]
    sample_dows = np.array([dt.weekday() for dt in local_dts])
    sample_hours = np.array([dt.hour for dt in local_dts])
    ages_days = np.array(
        [(now_local - dt).total_seconds() / 86400.0 for dt in local_dts]
    )

    recency = np.where(
        ages_days <= 0,
        1.0,
        np.exp(-math.log(2) * np.maximum(ages_days, 0.0) / HALF_LIFE_DAYS),
    )

    target_dow = target_date.weekday()
    dow_w = np.array([dow_kernel(target_dow, int(d)) for d in sample_dows])

    obs_is_holiday = np.array(
        [is_border_holiday(dt.date()) for dt in local_dts], dtype=bool
    )
    holiday_match = np.where(
        obs_is_holiday == is_holiday, 1.0, HOLIDAY_MISMATCH_WEIGHT
    )

    out = []
    for hour in range(24):
        hour_w = np.array([hour_kernel(hour, int(h)) for h in sample_hours])
        w = recency * dow_w * hour_w * holiday_match
        mask = w > MIN_WEIGHT_KEEP
        if not mask.any():
            continue
        ww = w[mask]
        vv = waits[mask]
        median = weighted_quantile(vv, ww, 0.5)
        p25 = weighted_quantile(vv, ww, 0.25)
        p75 = weighted_quantile(vv, ww, 0.75)
        if math.isnan(median):
            continue
        n_eff = effective_sample_size(ww)
        iqr = max(0.0, p75 - p25)
        out.append({
            "hour": hour,
            "predicted_wait": round(float(median), 1),
            "p25_wait": round(float(p25), 1),
            "p75_wait": round(float(p75), 1),
            "sample_count": int(mask.sum()),
            "n_eff": round(n_eff, 2),
            "confidence": compute_confidence_smoothed(n_eff, iqr, median, is_holiday),
        })
    return out


def apply_nowcast(
    predictions: list[dict],
    now_hour: int,
    live_wait: Optional[float],
) -> list[dict]:
    """Bias the next few hours toward today's deviation from baseline.

    If live wait is N min above the baseline-at-now, hour h ahead gets
    +N · exp(-h / NOWCAST_DECAY_HOURS) added, capped at NOWCAST_HORIZON_HOURS.
    """
    if live_wait is None or not predictions:
        return predictions
    by_hour = {p["hour"]: p for p in predictions}
    baseline_now = by_hour.get(now_hour, {}).get("predicted_wait")
    if baseline_now is None:
        return predictions
    adjustment = float(live_wait) - float(baseline_now)
    if abs(adjustment) < NOWCAST_MIN_DELTA_MIN:
        return predictions
    for p in predictions:
        h_ahead = p["hour"] - now_hour
        if h_ahead < 0 or h_ahead > NOWCAST_HORIZON_HOURS:
            continue
        decay = math.exp(-h_ahead / NOWCAST_DECAY_HOURS)
        new = max(0.0, p["predicted_wait"] + adjustment * decay)
        p["predicted_wait"] = round(new, 1)
        p["nowcasted"] = True
    return predictions
