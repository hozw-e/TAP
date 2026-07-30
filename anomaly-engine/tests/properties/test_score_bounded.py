# Feature: realtime-anomaly-detection, Property 6: Anomaly Score Bounded Range
"""Property-based tests verifying all anomaly score computations produce values
within the valid [0.0, 1.0] range for any valid inputs.

**Validates: Requirements 3.1, 3.8**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings

from src.models.score import clamp_score, compute_ratio_score


class TestClampScoreBounded:
    """clamp_score() must always return a value in [0.0, 1.0] for any float input."""

    @given(score=st.floats(allow_nan=False, allow_infinity=False))
    @settings(max_examples=200)
    def test_clamp_score_always_bounded(self, score):
        result = clamp_score(score)
        assert 0.0 <= result <= 1.0


class TestComputeRatioScoreBounded:
    """compute_ratio_score() must always return [0.0, 1.0] for any non-negative
    numerator and denominator."""

    @given(
        numerator=st.integers(min_value=0, max_value=1000),
        denominator=st.integers(min_value=0, max_value=1000),
    )
    @settings(max_examples=200)
    def test_ratio_score_always_bounded(self, numerator, denominator):
        result = compute_ratio_score(numerator, denominator)
        assert 0.0 <= result <= 1.0


class TestChronicTardinessScoreBounded:
    """Chronic tardiness score formula: score = min(1.0, tardy_ratio) where
    tardy_ratio = tardy_count / total_records. Must always be in [0.0, 1.0]."""

    @given(
        tardy_count=st.integers(min_value=0, max_value=1000),
        total_records=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=200)
    def test_chronic_tardiness_score_bounded(self, tardy_count, total_records):
        tardy_ratio = tardy_count / total_records
        score = min(1.0, tardy_ratio)
        assert 0.0 <= score <= 1.0


class TestAttendanceDropoffScoreBounded:
    """Attendance dropoff score formula: score = max(0, 1.0 - (dropoff_ratio / 0.4)).
    Must always be in [0.0, 1.0] for any non-negative dropoff_ratio."""

    @given(dropoff_ratio=st.floats(min_value=0.0, max_value=100.0))
    @settings(max_examples=200)
    def test_attendance_dropoff_score_bounded(self, dropoff_ratio):
        score = max(0.0, 1.0 - (dropoff_ratio / 0.4))
        score = min(1.0, max(0.0, score))
        assert 0.0 <= score <= 1.0


class TestIrregularTimingScoreBounded:
    """Irregular timing score formula: score = min(1.0, z_score / 4.0).
    Must always be in [0.0, 1.0] for any non-negative z_score."""

    @given(z_score=st.floats(min_value=0.0, max_value=100.0))
    @settings(max_examples=200)
    def test_irregular_timing_score_bounded(self, z_score):
        score = min(1.0, max(0.0, z_score / 4.0))
        assert 0.0 <= score <= 1.0


class TestEarlyDepartureScoreBounded:
    """Early departure score formula: score = min(1.0, count / 6.0).
    Must always be in [0.0, 1.0] for any non-negative count."""

    @given(count=st.integers(min_value=0, max_value=1000))
    @settings(max_examples=200)
    def test_early_departure_score_bounded(self, count):
        score = min(1.0, count / 6.0)
        score = max(0.0, score)
        assert 0.0 <= score <= 1.0
