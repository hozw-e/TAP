# Feature: realtime-anomaly-detection, Property 8: Attendance Dropoff Detection Correctness
"""Property-based tests for attendance dropoff detection.

Validates: Requirements 3.3

Tests the attendance dropoff detection algorithm:
    avg_weekly_frequency = total_attendances / (historical_window_days / 7)
    dropoff_ratio = recent_7day_frequency / avg_weekly_frequency
    score = max(0, 1.0 - (dropoff_ratio / 0.4))
    detected = dropoff_ratio < 0.4
    Minimum 14 days of history required.

Properties verified:
1. Detection occurs iff dropoff_ratio < 0.4 with 14+ days history
2. No detection when dropoff_ratio >= 0.4 with 14+ days history
3. No detection when history < 14 days regardless of ratio
4. Score always in [0.0, 1.0] when detected
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from src.detectors.attendance_dropoff import AttendanceDropoffDetector


# --- Strategies ---

# Historical window days: 14-90 (must be at least 14 for detection)
historical_window_days_st = st.integers(min_value=14, max_value=90)

# Total attendances in the window: 1-200
total_attendances_st = st.integers(min_value=1, max_value=200)

# Recent 7-day frequency: 0-50
recent_7day_frequency_st = st.integers(min_value=0, max_value=50)

# Days of history for sufficient cases: 14-90
sufficient_history_days_st = st.integers(min_value=14, max_value=90)

# Days of history for insufficient cases: 0-13
insufficient_history_days_st = st.integers(min_value=0, max_value=13)


def _make_mock_connection(first_date, total_count, recent_count):
    """Create a mock DB connection returning the specified values."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        {"first_date": first_date},
        {"total_count": total_count},
        {"recent_count": recent_count},
    ]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn


def _compute_dropoff_ratio(total_attendances, historical_window_days, recent_7day_frequency):
    """Compute the dropoff ratio from raw inputs."""
    weeks_in_window = historical_window_days / 7.0
    avg_weekly_frequency = total_attendances / weeks_in_window
    if avg_weekly_frequency == 0:
        return None
    return recent_7day_frequency / avg_weekly_frequency


class TestAttendanceDropoffDetectionProperty:
    """Property 8: Attendance Dropoff Detection Correctness."""

    def setup_method(self):
        self.detector = AttendanceDropoffDetector()
        self.event = {
            "student_id": 1,
            "student_name": "Test Student",
            "action": "check_in",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "course": "TestCourse",
            "attendance_flag": "present",
        }

    @given(
        historical_window_days=historical_window_days_st,
        total_attendances=total_attendances_st,
        recent_7day_frequency=recent_7day_frequency_st,
        days_of_history=sufficient_history_days_st,
    )
    @settings(max_examples=200)
    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_detection_when_dropoff_ratio_below_threshold(
        self,
        mock_get_conn,
        historical_window_days,
        total_attendances,
        recent_7day_frequency,
        days_of_history,
    ):
        """Detection MUST occur when dropoff_ratio < 0.4 with 14+ days history.

        **Validates: Requirements 3.3**
        """
        # Compute the expected dropoff ratio
        ratio = _compute_dropoff_ratio(
            total_attendances, historical_window_days, recent_7day_frequency
        )
        # Skip cases where avg_weekly_frequency would be 0
        assume(ratio is not None)
        # Only test cases where ratio < 0.4 (should trigger detection)
        assume(ratio < 0.4)
        # Ensure days_of_history >= 14
        assume(days_of_history >= 14)

        now = datetime.now(timezone.utc)
        first_date = (now - timedelta(days=days_of_history)).date()

        mock_get_conn.return_value = _make_mock_connection(
            first_date, total_attendances, recent_7day_frequency
        )

        config = {"historical_window_days": historical_window_days}
        result = self.detector.detect(1, self.event, config)

        # Detection MUST occur
        assert len(result) == 1, (
            f"Expected detection but got none. "
            f"ratio={ratio:.4f}, total={total_attendances}, "
            f"recent={recent_7day_frequency}, window={historical_window_days}"
        )
        assert result[0]["pattern_type"] == "attendance_dropoff"

    @given(
        historical_window_days=historical_window_days_st,
        total_attendances=total_attendances_st,
        recent_7day_frequency=recent_7day_frequency_st,
        days_of_history=sufficient_history_days_st,
    )
    @settings(max_examples=200)
    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_no_detection_when_dropoff_ratio_at_or_above_threshold(
        self,
        mock_get_conn,
        historical_window_days,
        total_attendances,
        recent_7day_frequency,
        days_of_history,
    ):
        """Detection MUST NOT occur when dropoff_ratio >= 0.4 with 14+ days history.

        **Validates: Requirements 3.3**
        """
        ratio = _compute_dropoff_ratio(
            total_attendances, historical_window_days, recent_7day_frequency
        )
        assume(ratio is not None)
        # Only test cases where ratio >= 0.4 (should NOT trigger detection)
        assume(ratio >= 0.4)
        assume(days_of_history >= 14)

        now = datetime.now(timezone.utc)
        first_date = (now - timedelta(days=days_of_history)).date()

        mock_get_conn.return_value = _make_mock_connection(
            first_date, total_attendances, recent_7day_frequency
        )

        config = {"historical_window_days": historical_window_days}
        result = self.detector.detect(1, self.event, config)

        # Detection MUST NOT occur
        assert len(result) == 0, (
            f"Expected no detection but got alert. "
            f"ratio={ratio:.4f}, total={total_attendances}, "
            f"recent={recent_7day_frequency}, window={historical_window_days}"
        )

    @given(
        historical_window_days=historical_window_days_st,
        total_attendances=total_attendances_st,
        recent_7day_frequency=recent_7day_frequency_st,
        days_of_history=insufficient_history_days_st,
    )
    @settings(max_examples=200)
    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_no_detection_with_insufficient_history(
        self,
        mock_get_conn,
        historical_window_days,
        total_attendances,
        recent_7day_frequency,
        days_of_history,
    ):
        """Detection MUST NOT occur when history < 14 days regardless of inputs.

        **Validates: Requirements 3.3**
        """
        assume(days_of_history < 14)

        now = datetime.now(timezone.utc)
        first_date = (now - timedelta(days=days_of_history)).date()

        # Mock returns first_date showing insufficient history
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {"first_date": first_date}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        config = {"historical_window_days": historical_window_days}
        result = self.detector.detect(1, self.event, config)

        # Detection MUST NOT occur
        assert len(result) == 0, (
            f"Expected no detection with {days_of_history} days history "
            f"but got alert."
        )

    @given(
        historical_window_days=historical_window_days_st,
        total_attendances=total_attendances_st,
        recent_7day_frequency=recent_7day_frequency_st,
        days_of_history=sufficient_history_days_st,
    )
    @settings(max_examples=200)
    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_score_bounded_when_detected(
        self,
        mock_get_conn,
        historical_window_days,
        total_attendances,
        recent_7day_frequency,
        days_of_history,
    ):
        """Score MUST be in [0.0, 1.0] when detection occurs.

        **Validates: Requirements 3.3**
        """
        ratio = _compute_dropoff_ratio(
            total_attendances, historical_window_days, recent_7day_frequency
        )
        assume(ratio is not None)
        # Only test cases where detection occurs
        assume(ratio < 0.4)
        assume(days_of_history >= 14)

        now = datetime.now(timezone.utc)
        first_date = (now - timedelta(days=days_of_history)).date()

        mock_get_conn.return_value = _make_mock_connection(
            first_date, total_attendances, recent_7day_frequency
        )

        config = {"historical_window_days": historical_window_days}
        result = self.detector.detect(1, self.event, config)

        assert len(result) == 1
        score = result[0]["score"]
        assert 0.0 <= score <= 1.0, (
            f"Score {score} out of bounds [0.0, 1.0]. "
            f"ratio={ratio:.4f}, total={total_attendances}, "
            f"recent={recent_7day_frequency}, window={historical_window_days}"
        )
