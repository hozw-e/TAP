"""Unit tests for the irregular timing detector."""

from unittest.mock import patch

import numpy as np
import pytest

from src.detectors.irregular_timing import IrregularTimingDetector


@pytest.fixture
def detector():
    return IrregularTimingDetector()


@pytest.fixture
def config():
    return {"historical_window_days": 30}


class TestIrregularTimingDetector:
    """Tests for IrregularTimingDetector.detect()."""

    def test_no_course_returns_empty(self, detector, config):
        """Should return empty list when course is None."""
        event = {"timestamp": "2024-01-15T08:30:00", "course": None}
        result = detector.detect(1, event, config)
        assert result == []

    def test_no_timestamp_returns_empty(self, detector, config):
        """Should return empty list when timestamp is missing."""
        event = {"timestamp": None, "course": "Arduino"}
        result = detector.detect(1, event, config)
        assert result == []

    def test_invalid_timestamp_returns_empty(self, detector, config):
        """Should return empty list for invalid timestamp format."""
        event = {"timestamp": "not-a-date", "course": "Arduino"}
        result = detector.detect(1, event, config)
        assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_insufficient_records_returns_empty(self, mock_query, detector, config):
        """Should return empty when fewer than 4 historical records."""
        mock_query.return_value = [480, 485, 490]  # Only 3 records
        event = {"timestamp": "2024-01-15T08:30:00", "course": "Arduino"}
        result = detector.detect(1, event, config)
        assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_zero_stddev_returns_empty(self, mock_query, detector, config):
        """Should return empty when all historical times are identical (stddev=0)."""
        mock_query.return_value = [480, 480, 480, 480]  # All same time
        event = {"timestamp": "2024-01-15T09:00:00", "course": "Arduino"}
        result = detector.detect(1, event, config)
        assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_normal_timing_no_anomaly(self, mock_query, detector, config):
        """Should return empty when check-in is within 2 stddev."""
        # Historical times around 8:00 AM (480 minutes) with some spread
        mock_query.return_value = [475, 480, 485, 490, 478, 482]
        # Current check-in at 8:05 AM (485 minutes) - well within range
        event = {"timestamp": "2024-01-15T08:05:00", "course": "Arduino"}
        result = detector.detect(1, event, config)
        assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_anomalous_timing_detected(self, mock_query, detector, config):
        """Should detect anomaly when check-in deviates by more than 2 stddev."""
        # Historical times tightly clustered around 8:00 AM (480 minutes)
        # stddev ~5 minutes
        mock_query.return_value = [478, 480, 482, 484, 476]
        # Current check-in at 10:00 AM (600 minutes) - far outside normal range
        event = {"timestamp": "2024-01-15T10:00:00", "course": "Arduino"}
        result = detector.detect(1, event, config)

        assert len(result) == 1
        assert result[0]["student_id"] == 1
        assert result[0]["pattern_type"] == "irregular_timing"
        assert result[0]["detected"] is True
        assert 0.0 <= result[0]["score"] <= 1.0

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_score_clamped_at_1(self, mock_query, detector, config):
        """Score should be clamped at 1.0 even for extreme deviations."""
        # Very tight cluster with extreme deviation
        mock_query.return_value = [480, 480, 481, 479, 480]
        # Check-in very far from mean (midday vs early morning)
        event = {"timestamp": "2024-01-15T16:00:00", "course": "Arduino"}
        result = detector.detect(1, event, config)

        assert len(result) == 1
        assert result[0]["score"] <= 1.0

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_score_formula_correctness(self, mock_query, detector, config):
        """Score should follow min(1.0, z_score/4.0) formula."""
        # Create a scenario where we can predict the exact score
        # times: 480, 480, 480, 500 -> mean=485, std≈8.66
        mock_query.return_value = [480, 480, 480, 500]
        # Check-in at 510 minutes (8:30+30=510), deviation=25, z=25/8.66≈2.89
        event = {"timestamp": "2024-01-15T08:30:00", "course": "Arduino"}
        result = detector.detect(1, event, config)

        # Manually compute expected values
        times = np.array([480, 480, 480, 500], dtype=np.float64)
        mean = np.mean(times)
        stddev = np.std(times)
        current_minutes = 8 * 60 + 30  # 510
        deviation = abs(current_minutes - mean)
        z_score = deviation / stddev
        expected_score = min(1.0, z_score / 4.0)

        if z_score > 2.0:
            assert len(result) == 1
            assert abs(result[0]["score"] - round(expected_score, 4)) < 0.001
        else:
            assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_exactly_at_2_stddev_threshold(self, mock_query, detector, config):
        """At exactly 2 stddev, z_score is not > 2.0, so no detection."""
        # Create data where we know the stddev exactly
        # [480, 520] -> mean=500, std=20
        # Need 4 records: [480, 520, 480, 520] -> mean=500, std=20
        mock_query.return_value = [480, 520, 480, 520]
        # Check-in at 540 -> deviation=40, z=40/20=2.0 (exactly 2, not > 2)
        event = {"timestamp": "2024-01-15T09:00:00", "course": "Arduino"}
        # 9:00 AM = 540 minutes
        result = detector.detect(1, event, config)

        # z_score = 40/20 = 2.0, which is NOT > 2.0
        assert result == []

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_just_above_2_stddev_threshold(self, mock_query, detector, config):
        """Just above 2 stddev should trigger detection."""
        # [480, 520, 480, 520] -> mean=500, std=20
        mock_query.return_value = [480, 520, 480, 520]
        # Check-in at 541 -> deviation=41, z=41/20=2.05 (> 2.0)
        event = {"timestamp": "2024-01-15T09:01:00", "course": "Arduino"}
        # 9:01 AM = 541 minutes
        result = detector.detect(1, event, config)

        assert len(result) == 1
        assert result[0]["detected"] is True

    @patch.object(IrregularTimingDetector, "_query_historical_times")
    def test_score_never_negative(self, mock_query, detector, config):
        """Score should never be negative."""
        mock_query.return_value = [480, 485, 490, 495]
        # Check-in at the mean time
        event = {"timestamp": "2024-01-15T08:07:00", "course": "Arduino"}
        result = detector.detect(1, event, config)
        # Even if not detected, the internal score computation should never produce negative
        # When not detected, empty list is returned, so score is implicitly 0
        assert result == [] or all(r["score"] >= 0.0 for r in result)
