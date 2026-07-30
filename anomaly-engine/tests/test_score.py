"""Unit tests for score computation utilities."""

import pytest

from src.models.score import clamp_score, compute_ratio_score


class TestClampScore:
    """Tests for clamp_score function."""

    def test_value_within_range_unchanged(self):
        assert clamp_score(0.5) == 0.5

    def test_zero_unchanged(self):
        assert clamp_score(0.0) == 0.0

    def test_one_unchanged(self):
        assert clamp_score(1.0) == 1.0

    def test_negative_clamped_to_zero(self):
        assert clamp_score(-0.5) == 0.0

    def test_above_one_clamped_to_one(self):
        assert clamp_score(1.5) == 1.0

    def test_large_negative_clamped_to_zero(self):
        assert clamp_score(-100.0) == 0.0

    def test_large_positive_clamped_to_one(self):
        assert clamp_score(100.0) == 1.0


class TestComputeRatioScore:
    """Tests for compute_ratio_score function."""

    def test_zero_denominator_returns_zero(self):
        assert compute_ratio_score(5, 0) == 0.0

    def test_simple_ratio(self):
        assert compute_ratio_score(3, 10) == pytest.approx(0.3)

    def test_full_ratio(self):
        assert compute_ratio_score(10, 10) == 1.0

    def test_ratio_exceeding_one_clamped(self):
        assert compute_ratio_score(15, 10) == 1.0

    def test_zero_numerator(self):
        assert compute_ratio_score(0, 10) == 0.0

    def test_half_ratio(self):
        assert compute_ratio_score(5, 10) == pytest.approx(0.5)
