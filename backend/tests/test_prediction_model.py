"""Tests for the pure prediction-model helpers."""
import math
from datetime import date, datetime, timedelta

import numpy as np
import pytest

from app.services.prediction_model import (
    apply_nowcast,
    border_holidays,
    compute_confidence_smoothed,
    cyclic_hour_distance,
    dow_kernel,
    easter_sunday,
    effective_sample_size,
    hour_kernel,
    is_border_holiday,
    recency_weight,
    smooth_predictions,
    weighted_quantile,
)


class TestCyclicHour:
    def test_zero_distance(self):
        assert cyclic_hour_distance(5, 5) == 0

    def test_wraps_around_midnight(self):
        # 23 and 0 are adjacent on the cycle
        assert cyclic_hour_distance(23, 0) == 1
        assert cyclic_hour_distance(22, 1) == 3

    def test_max_distance_is_12(self):
        assert cyclic_hour_distance(0, 12) == 12
        assert cyclic_hour_distance(6, 18) == 12


class TestHourKernel:
    def test_same_hour_full_weight(self):
        assert hour_kernel(10, 10) == pytest.approx(1.0)

    def test_decays_with_distance(self):
        w0 = hour_kernel(10, 10)
        w1 = hour_kernel(10, 11)
        w2 = hour_kernel(10, 12)
        assert w0 > w1 > w2 > 0

    def test_wraps_around_midnight(self):
        # Hour 0 should see hour 23 as a near neighbor
        assert hour_kernel(0, 23) == pytest.approx(hour_kernel(0, 1))


class TestDowKernel:
    def test_same_dow_full_weight(self):
        assert dow_kernel(2, 2) == 1.0

    def test_weekday_to_weekday_adjacent_higher_than_weekend(self):
        # Tuesday (1) to Wednesday (2): adjacent same group
        # Tuesday (1) to Saturday (5): cross-group
        assert dow_kernel(1, 2) > dow_kernel(1, 5)

    def test_weekend_pair_borrows_from_each_other(self):
        # Saturday (5) <-> Sunday (6) — adjacent same-group
        assert dow_kernel(5, 6) > dow_kernel(5, 2)


class TestRecencyWeight:
    def test_zero_age_full_weight(self):
        assert recency_weight(0.0) == 1.0

    def test_half_life_halves_weight(self):
        # 21-day default half-life
        assert recency_weight(21.0) == pytest.approx(0.5, rel=1e-3)
        assert recency_weight(42.0) == pytest.approx(0.25, rel=1e-3)


class TestWeightedQuantile:
    def test_equal_weights_match_unweighted(self):
        v = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        w = np.ones(5)
        assert weighted_quantile(v, w, 0.5) in (3.0, 2.0)  # boundary

    def test_dominant_weight_wins(self):
        v = np.array([1.0, 100.0])
        w = np.array([100.0, 1.0])
        # Mostly weight on 1.0, so median sits at 1.0
        assert weighted_quantile(v, w, 0.5) == 1.0

    def test_empty_returns_nan(self):
        assert math.isnan(weighted_quantile(np.array([]), np.array([]), 0.5))


class TestEffectiveSampleSize:
    def test_uniform_weights_is_n(self):
        w = np.ones(10)
        assert effective_sample_size(w) == pytest.approx(10.0)

    def test_one_dominant_weight_is_near_one(self):
        w = np.array([100.0, 0.01, 0.01, 0.01])
        assert effective_sample_size(w) < 1.5


class TestConfidence:
    def test_low_n_eff_is_low(self):
        assert compute_confidence_smoothed(2.0, 10.0, 20.0, False) == "low"

    def test_high_n_eff_low_iqr_is_high(self):
        assert compute_confidence_smoothed(40.0, 5.0, 20.0, False) == "high"

    def test_high_n_eff_huge_iqr_drops_to_medium(self):
        # IQR 80 > max(45, 1.5 * 20) = 45
        assert compute_confidence_smoothed(40.0, 80.0, 20.0, False) == "medium"

    def test_high_n_eff_overnight_variance_stays_high(self):
        # Median 35 with IQR 50 is normal overnight variance, not noise:
        # 50 <= max(45, 52.5) so the cell should stay "high".
        assert compute_confidence_smoothed(400.0, 50.0, 35.0, False) == "high"

    def test_holiday_demotes_high_to_medium(self):
        assert compute_confidence_smoothed(40.0, 5.0, 20.0, True) == "medium"

    def test_holiday_does_not_compound_medium(self):
        # A medium-confidence prediction stays medium even on a holiday — the
        # isHoliday flag in the response signals the caveat without trashing
        # the label further.
        assert compute_confidence_smoothed(10.0, 5.0, 20.0, True) == "medium"


class TestHolidays:
    def test_christmas_is_holiday(self):
        assert is_border_holiday(date(2026, 12, 25))

    def test_july_4_is_holiday(self):
        assert is_border_holiday(date(2026, 7, 4))

    def test_random_tuesday_is_not(self):
        assert not is_border_holiday(date(2026, 3, 17))

    def test_easter_sunday_known_dates(self):
        # Easter dates are well-known anchors
        assert easter_sunday(2024) == date(2024, 3, 31)
        assert easter_sunday(2025) == date(2025, 4, 20)
        assert easter_sunday(2026) == date(2026, 4, 5)

    def test_good_friday_in_set(self):
        # Good Friday is Easter - 2 days
        e = easter_sunday(2026)
        good_friday = e - timedelta(days=2)
        assert good_friday in border_holidays(2026)


class TestSmoothPredictions:
    def _build_obs(self, n_per_hour: int = 5):
        """Build synthetic observations: 5 per (dow, hour), 60 days back, wait = hour * 3."""
        obs = []
        now = datetime(2026, 5, 12, 12, 0, 0)
        for days_back in range(0, 60, 2):
            dt_day = now - timedelta(days=days_back)
            for hour in range(24):
                for _ in range(n_per_hour):
                    obs.append(
                        (
                            dt_day.replace(hour=hour, minute=0, second=0),
                            hour * 3,
                        )
                    )
        return obs

    def test_returns_24_hours_with_enough_data(self):
        obs = self._build_obs(n_per_hour=5)
        out = smooth_predictions(
            obs, date(2026, 5, 13), datetime(2026, 5, 12, 12, 0, 0), False
        )
        assert len(out) == 24
        for p in out:
            assert "predicted_wait" in p
            assert p["confidence"] in ("low", "medium", "high")

    def test_predictions_track_synthetic_hour_pattern(self):
        obs = self._build_obs(n_per_hour=5)
        out = smooth_predictions(
            obs, date(2026, 5, 13), datetime(2026, 5, 12, 12, 0, 0), False
        )
        by_hour = {p["hour"]: p["predicted_wait"] for p in out}
        # We seeded wait = hour * 3, with smoothing the predicted should be close
        for hour in (3, 9, 15, 21):
            assert abs(by_hour[hour] - hour * 3) <= 6.0, (
                f"hour {hour}: predicted {by_hour[hour]}, expected ~{hour * 3}"
            )

    def test_empty_returns_empty(self):
        assert smooth_predictions(
            [], date(2026, 5, 13), datetime(2026, 5, 12, 12, 0, 0), False
        ) == []


class TestNowcast:
    def test_no_live_wait_is_noop(self):
        preds = [{"hour": 12, "predicted_wait": 30.0}]
        out = apply_nowcast(preds, now_hour=12, live_wait=None)
        assert out[0]["predicted_wait"] == 30.0
        assert "nowcasted" not in out[0]

    def test_small_delta_is_noop(self):
        preds = [{"hour": 12, "predicted_wait": 30.0}]
        out = apply_nowcast(preds, now_hour=12, live_wait=32.0)
        assert out[0]["predicted_wait"] == 30.0

    def test_large_delta_lifts_current_hour(self):
        preds = [
            {"hour": 12, "predicted_wait": 30.0},
            {"hour": 13, "predicted_wait": 30.0},
            {"hour": 14, "predicted_wait": 30.0},
            {"hour": 16, "predicted_wait": 30.0},
        ]
        out = apply_nowcast(preds, now_hour=12, live_wait=60.0)
        by_hour = {p["hour"]: p for p in out}
        # Adjustment +30 with exp(-h/1.5) decay
        assert by_hour[12]["predicted_wait"] == pytest.approx(60.0, abs=0.2)
        assert by_hour[12]["nowcasted"] is True
        # 13 should be raised but less
        assert 30.0 < by_hour[13]["predicted_wait"] < 60.0
        # 4 hours out is past horizon, unchanged
        assert by_hour[16]["predicted_wait"] == 30.0
        assert "nowcasted" not in by_hour[16]

    def test_clips_at_zero(self):
        preds = [{"hour": 12, "predicted_wait": 10.0}]
        out = apply_nowcast(preds, now_hour=12, live_wait=-50.0)
        assert out[0]["predicted_wait"] >= 0.0
