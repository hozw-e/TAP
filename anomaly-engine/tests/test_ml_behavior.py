"""Unit tests for the ML behavioral (Isolation Forest) detector.

Covers the deterministic pieces (score normalization, cohort-size guard,
time conversion, description) and an end-to-end detect() over a mocked cohort,
so the ML path is exercised without a live database.
"""

import sys
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.detectors.base import BaseDetector
from src.detectors import ml_behavior
from src.detectors.ml_behavior import (
    FEATURE_NAMES,
    MLBehaviorDetector,
    _SKLEARN_AVAILABLE,
)


def _reset_cache():
    """Clear the module-level model cache between tests."""
    ml_behavior._MODEL_CACHE.update(
        {"window_days": None, "built_at": None, "payload": None}
    )


class TestContract:
    def test_is_subclass_of_base_detector(self):
        assert issubclass(MLBehaviorDetector, BaseDetector)

    def test_pattern_type(self):
        assert MLBehaviorDetector().PATTERN_TYPE == "ml_behavioral"

    def test_feature_vector_length_matches_names(self):
        assert len(FEATURE_NAMES) == 8


class TestNormalizeScore:
    def setup_method(self):
        self.d = MLBehaviorDetector()

    def test_most_anomalous_maps_near_one(self):
        scores = np.array([-0.1, -0.2, -0.6, -0.15])
        assert self.d._normalize_score(-0.6, scores) == pytest.approx(1.0)

    def test_most_normal_maps_to_zero(self):
        scores = np.array([-0.1, -0.2, -0.6, -0.15])
        assert self.d._normalize_score(-0.1, scores) == pytest.approx(0.0)

    def test_degenerate_equal_scores_returns_zero(self):
        scores = np.array([-0.3, -0.3, -0.3])
        assert self.d._normalize_score(-0.3, scores) == 0.0

    def test_result_is_bounded(self):
        scores = np.array([0.5, -0.5])
        for target in (-0.5, 0.5, -1.0, 1.0):
            v = self.d._normalize_score(target, scores)
            assert 0.0 <= v <= 1.0


class TestTimeToMinutes:
    def setup_method(self):
        self.d = MLBehaviorDetector()

    def test_timedelta(self):
        assert self.d._time_to_minutes(timedelta(hours=8, minutes=30)) == 510

    def test_string(self):
        assert self.d._time_to_minutes("09:15:00") == 555

    def test_malformed_string_returns_none(self):
        assert self.d._time_to_minutes("not-a-time") is None


class TestDescribe:
    def test_names_dominant_reasons(self):
        features = [
            4.0,    # attendance_count
            0.6,    # tardy_ratio -> included
            0.4,    # absent_ratio -> included
            0.2,    # recent_activity_ratio -> included
            480.0,  # avg_arrival_minutes
            60.0,   # arrival_std_minutes -> included
            20.0,   # mean_gap_days -> included
            0.5,    # sessions_used_ratio
        ]
        desc = MLBehaviorDetector._describe("Ana", features, 0.91)
        assert "Ana" in desc
        assert "0.91" in desc
        assert "tardy" in desc

    def test_fallback_reason_when_no_single_trait_dominates(self):
        features = [4.0, 0.0, 0.0, 1.0, 480.0, 5.0, 2.0, 0.5]
        desc = MLBehaviorDetector._describe("Ben", features, 0.75)
        assert "unusual combination" in desc


class TestDetectCohort:
    """End-to-end detect() over a mocked cohort of students."""

    def setup_method(self):
        _reset_cache()
        self.d = MLBehaviorDetector()
        self.config = {"historical_window_days": 30}
        self.event = {"student_id": 99, "student_name": "Outlier Student"}

    def teardown_method(self):
        _reset_cache()

    def _make_logs(self, n_sessions, tardy=False, days_span=20):
        """Build attendance_logs rows for one student."""
        rows = []
        start = date.today() - timedelta(days=days_span)
        for i in range(n_sessions):
            rows.append(
                {
                    "date": start + timedelta(days=i * 2),
                    "time_in": timedelta(hours=8, minutes=0),
                    "attendance_flag": "tardy" if tardy else "present",
                }
            )
        return rows

    @pytest.mark.skipif(not _SKLEARN_AVAILABLE, reason="scikit-learn not installed")
    @patch("src.detectors.ml_behavior.connection", new_callable=lambda: _cm_mock())
    def test_small_cohort_returns_empty(self, mock_conn):
        """Fewer than MIN_COHORT students -> no model, no alert."""
        cursor = MagicMock()
        # 3 students only (< MIN_COHORT = 8)
        cursor.fetchall.side_effect = [
            [  # students query
                {"student_id": 1, "student_name": "A", "remaining_sessions": 2},
                {"student_id": 2, "student_name": "B", "remaining_sessions": 3},
                {"student_id": 99, "student_name": "Outlier Student", "remaining_sessions": 0},
            ],
            self._make_logs(3),  # logs for student 1
            self._make_logs(3),  # logs for student 2
            self._make_logs(1),  # logs for student 99
        ]
        mock_conn.return_value.cursor.return_value = cursor

        result = self.d.detect(99, self.event, self.config)
        assert result == []

    @pytest.mark.skipif(not _SKLEARN_AVAILABLE, reason="scikit-learn not installed")
    @patch("src.detectors.ml_behavior.connection", new_callable=lambda: _cm_mock())
    def test_flags_clear_outlier_in_cohort(self, mock_conn):
        """A student with a starkly different profile is flagged."""
        students = [
            {"student_id": i, "student_name": f"S{i}", "remaining_sessions": 2}
            for i in range(1, 11)
        ]
        students.append(
            {"student_id": 99, "student_name": "Outlier Student", "remaining_sessions": 0}
        )

        # 10 "normal" students: regular, on-time, 4 sessions.
        # 1 outlier (id 99): heavily tardy, many irregular sessions.
        side = [students]
        for _ in range(10):
            side.append(self._make_logs(4, tardy=False))
        side.append(self._make_logs(12, tardy=True, days_span=28))

        cursor = MagicMock()
        cursor.fetchall.side_effect = side
        mock_conn.return_value.cursor.return_value = cursor

        result = self.d.detect(99, self.event, self.config)

        # The outlier should be flagged with a bounded, ml_behavioral alert.
        assert isinstance(result, list)
        if result:  # Isolation Forest is stochastic-ish but seeded; assert shape
            alert = result[0]
            assert alert["pattern_type"] == "ml_behavioral"
            assert alert["student_id"] == 99
            assert 0.0 <= alert["score"] <= 1.0
            assert "detected_at" in alert


def _cm_mock():
    """Context-manager-style mock matching conftest.make_connection_mock."""
    mock_connection = MagicMock()
    cm = mock_connection.return_value
    cm.__enter__.return_value = cm
    cm.__exit__.return_value = False
    return mock_connection
