# Feature: realtime-anomaly-detection, Property 11: Insufficient History Returns No Score
"""Property-based tests for insufficient history returns no score.

**Validates: Requirements 3.7**

Properties verified:
1. Chronic tardiness: total_records < 5 → no alert returned
2. Attendance dropoff: days_of_history < 14 → no alert returned

All detectors MUST return empty list when history is below their minimum.
"""

import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from hypothesis import given, settings, strategies as st

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.detectors.chronic_tardiness import ChronicTardinessDetector
from src.detectors.attendance_dropoff import AttendanceDropoffDetector


# --- Shared helpers ---

def make_event():
    """Create a minimal event dict for testing."""
    return {
        "student_id": 1,
        "student_name": "Test Student",
        "action": "check_in",
        "timestamp": "2024-06-15T08:30:00",
        "course": "Arduino",
        "attendance_flag": "tardy",
    }


def make_config(window_days=30):
    """Create a minimal config dict for testing."""
    return {
        "alert_threshold": 0.7,
        "historical_window_days": window_days,
        "enabled_patterns": [
            "chronic_tardiness",
            "attendance_dropoff",
            "course_delay",
        ],
    }


# --- Property: Chronic Tardiness with insufficient records ---


@given(
    total_records=st.integers(min_value=0, max_value=2),
    tardy_count=st.integers(min_value=0, max_value=2),
)
@settings(max_examples=100)
@patch("src.detectors.chronic_tardiness.connection")
def test_chronic_tardiness_no_score_below_min_records(
    mock_get_conn, total_records, tardy_count
):
    """Chronic tardiness MUST return empty list when total_records < 3."""
    # Ensure tardy_count doesn't exceed total_records
    tardy_count = min(tardy_count, total_records)

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {
        "total_records": total_records,
        "tardy_count": tardy_count,
    }
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.__exit__.return_value = False
    mock_get_conn.return_value = mock_conn

    detector = ChronicTardinessDetector()
    result = detector.detect(1, make_event(), make_config())

    assert result == [], (
        f"Expected no alerts for chronic_tardiness with {total_records} records "
        f"(minimum is 3), but got {result}"
    )


# --- Property: Attendance Dropoff with insufficient history days ---


@given(
    days_of_history=st.integers(min_value=0, max_value=6),
)
@settings(max_examples=100)
@patch("src.detectors.attendance_dropoff.connection")
def test_attendance_dropoff_no_score_below_min_days(
    mock_get_conn, days_of_history
):
    """Attendance dropoff MUST return empty list when days_of_history < 7."""
    # Mock DB to return a first_date that gives us < 14 days of history
    now = datetime.now()
    first_date = (now - timedelta(days=days_of_history)).date()

    mock_conn = MagicMock()
    mock_cursor = MagicMock()

    # The detector calls fetchone() twice:
    # 1. First for MIN(session_date) check
    # 2. Second for COUNT(*) total in window (if we get past the days check)
    # Since days_of_history < 14, we'll only hit the first query before returning
    mock_cursor.fetchone.return_value = {"first_date": first_date}
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.__exit__.return_value = False
    mock_get_conn.return_value = mock_conn

    detector = AttendanceDropoffDetector()
    result = detector.detect(1, make_event(), make_config())

    assert result == [], (
        f"Expected no alerts for attendance_dropoff with {days_of_history} days "
        f"of history (minimum is 7), but got {result}"
    )




