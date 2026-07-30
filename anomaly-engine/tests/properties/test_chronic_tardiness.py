# Feature: realtime-anomaly-detection, Property 7: Chronic Tardiness Detection Correctness
"""Property-based tests for chronic tardiness detection correctness.

**Validates: Requirements 3.2**

Properties verified:
1. For any total_records >= 5 and tardy_count where tardy_count/total_records > 0.5:
   detection MUST occur (alert returned)
2. For any total_records >= 5 and tardy_count where tardy_count/total_records <= 0.5:
   detection MUST NOT occur (empty list)
3. For any total_records < 5: detection MUST NOT occur regardless of tardy_count
4. When detected, score == tardy_ratio (capped at 1.0)
"""

import sys
from unittest.mock import MagicMock, patch

from hypothesis import given, strategies as st, assume

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.detectors.chronic_tardiness import ChronicTardinessDetector


# --- Shared fixtures ---

def make_event(student_name="Test Student"):
    """Create a minimal event dict for testing."""
    return {
        "student_id": 1,
        "student_name": student_name,
        "action": "check_in",
        "timestamp": "2024-01-15T08:30:00",
        "course": "Arduino",
        "attendance_flag": "tardy",
    }


def make_config(window_days=30):
    """Create a minimal config dict for testing."""
    return {
        "alert_threshold": 0.7,
        "historical_window_days": window_days,
        "enabled_patterns": ["chronic_tardiness"],
    }


def mock_db_row(total_records, tardy_count):
    """Create a mock connection that returns the specified row."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {
        "total_records": total_records,
        "tardy_count": tardy_count,
    }
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn


# --- Property tests ---


@given(
    total_records=st.integers(min_value=5, max_value=1000),
    tardy_count=st.integers(min_value=0, max_value=1000),
)
@patch("src.detectors.chronic_tardiness.get_connection")
def test_detects_when_ratio_exceeds_half(mock_get_conn, total_records, tardy_count):
    """Detection MUST occur when tardy_ratio > 0.5 with >= 5 records."""
    # Constrain tardy_count to valid range and ensure ratio > 0.5
    tardy_count = min(tardy_count, total_records)
    assume(tardy_count / total_records > 0.5)

    mock_get_conn.return_value = mock_db_row(total_records, tardy_count)

    detector = ChronicTardinessDetector()
    result = detector.detect(1, make_event(), make_config())

    assert len(result) == 1, (
        f"Expected detection with {tardy_count}/{total_records} tardy ratio "
        f"({tardy_count/total_records:.4f} > 0.5)"
    )
    assert result[0]["pattern_type"] == "chronic_tardiness"


@given(
    total_records=st.integers(min_value=5, max_value=1000),
    tardy_count=st.integers(min_value=0, max_value=1000),
)
@patch("src.detectors.chronic_tardiness.get_connection")
def test_no_detection_when_ratio_at_or_below_half(mock_get_conn, total_records, tardy_count):
    """Detection MUST NOT occur when tardy_ratio <= 0.5 with >= 5 records."""
    # Constrain tardy_count to valid range and ensure ratio <= 0.5
    tardy_count = min(tardy_count, total_records)
    assume(tardy_count / total_records <= 0.5)

    mock_get_conn.return_value = mock_db_row(total_records, tardy_count)

    detector = ChronicTardinessDetector()
    result = detector.detect(1, make_event(), make_config())

    assert result == [], (
        f"Expected no detection with {tardy_count}/{total_records} tardy ratio "
        f"({tardy_count/total_records:.4f} <= 0.5)"
    )


@given(
    total_records=st.integers(min_value=0, max_value=4),
    tardy_count=st.integers(min_value=0, max_value=4),
)
@patch("src.detectors.chronic_tardiness.get_connection")
def test_no_detection_when_insufficient_records(mock_get_conn, total_records, tardy_count):
    """Detection MUST NOT occur when total_records < 5 regardless of tardy_count."""
    # Constrain tardy_count to valid range
    tardy_count = min(tardy_count, total_records)

    mock_get_conn.return_value = mock_db_row(total_records, tardy_count)

    detector = ChronicTardinessDetector()
    result = detector.detect(1, make_event(), make_config())

    assert result == [], (
        f"Expected no detection with only {total_records} records (minimum is 5)"
    )


@given(
    total_records=st.integers(min_value=5, max_value=1000),
    tardy_count=st.integers(min_value=0, max_value=1000),
)
@patch("src.detectors.chronic_tardiness.get_connection")
def test_score_equals_tardy_ratio_capped_at_one(mock_get_conn, total_records, tardy_count):
    """When detected, score == min(1.0, tardy_ratio)."""
    # Constrain tardy_count to valid range and ensure detection occurs
    tardy_count = min(tardy_count, total_records)
    assume(tardy_count / total_records > 0.5)

    mock_get_conn.return_value = mock_db_row(total_records, tardy_count)

    detector = ChronicTardinessDetector()
    result = detector.detect(1, make_event(), make_config())

    assert len(result) == 1

    expected_ratio = tardy_count / total_records
    expected_score = min(1.0, expected_ratio)
    actual_score = result[0]["score"]

    assert actual_score == round(expected_score, 4), (
        f"Expected score={round(expected_score, 4)} "
        f"(ratio={expected_ratio:.6f}), got {actual_score}"
    )
