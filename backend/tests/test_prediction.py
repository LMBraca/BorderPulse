"""Tests for the prediction service."""
import pytest
from app.services.prediction import compute_confidence


class TestComputeConfidence:
    def test_low_samples(self):
        assert compute_confidence(3, 10.0) == "low"

    def test_medium_samples(self):
        assert compute_confidence(15, 20.0) == "medium"

    def test_high_samples_low_variance(self):
        assert compute_confidence(50, 15.0) == "high"

    def test_high_samples_high_variance(self):
        # High count but very unpredictable → medium
        assert compute_confidence(100, 80.0) == "medium"

    def test_boundary_low_medium(self):
        assert compute_confidence(6, 10.0) == "low"
        assert compute_confidence(7, 10.0) == "medium"

    def test_boundary_medium_high(self):
        assert compute_confidence(29, 10.0) == "medium"
        assert compute_confidence(30, 10.0) == "high"

    def test_single_sample(self):
        assert compute_confidence(1, 0.0) == "low"

    def test_zero_variance_high_count(self):
        assert compute_confidence(100, 0.0) == "high"
