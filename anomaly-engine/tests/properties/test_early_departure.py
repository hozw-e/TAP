# Feature: realtime-anomaly-detection, Property 10: Early Departure Detection Correctness
"""Property-based tests verifying early departure detection logic:
- Detection occurs iff 3+ sessions have actual duration < 50% of scheduled duration
- Score is always in [0.0, 1.0]
- Score formula: min(1.0, short_session_count / 6.0)
- Sessions with invalid durations (scheduled <= 0 or actual is None) are skipped

**Validates: Requirements 3.5**
"""

from unittest.mock import MagicMock, patch

import hypothesis.strategies as st
from hypothesis import assume, given, settings

from src.detectors.early_departure import EarlyDepartureDetector


# --- Strategies ---

def session_strategy():
    """Generate a single session as a dict with actual_minutes and scheduled_minutes."""
    return st.fixed_dictionaries(
        {
            "actual_minutes": st.one_of(
                st.integers(min_value=0, max_value=300),
                st.none(),
            ),
            "scheduled_minutes": st.integers(min_value=-10, max_value=300),
        }
    )


def valid_session_strategy():
    """Generate a valid session (scheduled > 0, actual is not None)."""
    return st.fixed_dictionaries(
        {
            "actual_minutes": st.integers(min_value=0, max_value=300),
            "scheduled_minutes": st.integers(min_value=1, max_value=300),
        }
    )


def short_session_strategy():
    """Generate a session that is definitely 'early' (actual < 50% scheduled).
    We ensure scheduled >= 2 so that actual can be 0 to floor(scheduled/2)-1."""
    return st.integers(min_value=2, max_value=300).flatmap(
        lambda scheduled: st.fixed_dictionaries(
            {
                "actual_minutes": st.integers(
                    min_value=0, max_value=max(0, (scheduled - 1) // 2)
                ),
                "scheduled_minutes": st.just(scheduled),
            }
        )
    )


def long_session_strategy():
    """Generate a session that is NOT early (actual >= 50% scheduled)."""
    return st.integers(min_value=1, max_value=300).flatmap(
        lambda scheduled: st.fixed_dictionaries(
            {
                "actual_minutes": st.integers(
                    min_value=(scheduled + 1) // 2, max_value=scheduled + 60
                ),
                "scheduled_minutes": st.just(scheduled),
            }
        )
    )


# --- Helper to run the detector with mocked DB ---

def run_detector_with_rows(rows):
    """Run the EarlyDepartureDetector with mocked DB returning the given rows."""
    detector = EarlyDepartureDetector()
    event = {"student_name": "Test Student"}
    config = {"historical_window_days": 30}

    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    with patch("src.detectors.early_departure.get_connection", return_value=mock_conn):
        return detector.detect(student_id=1, event=event, config=config)


def count_short_sessions(rows):
    """Count sessions where actual < 50% scheduled, skipping invalid entries."""
    count = 0
    for row in rows:
        actual = row["actual_minutes"]
        scheduled = row["scheduled_minutes"]
        if actual is None or scheduled is None:
            continue
        if scheduled <= 0:
            continue
        if actual < 0.5 * scheduled:
            count += 1
    return count


# --- Property Tests ---


class TestEarlyDepartureDetectionOccurs:
    """Detection MUST occur when 3+ sessions have actual < 50% scheduled."""

    @given(
        short_sessions=st.lists(
            short_session_strategy(), min_size=3, max_size=20
        ),
        other_sessions=st.lists(
            long_session_strategy(), min_size=0, max_size=10
        ),
    )
    @settings(max_examples=200)
    def test_detection_when_three_or_more_short_sessions(
        self, short_sessions, other_sessions
    ):
        rows = short_sessions + other_sessions
        results = run_detector_with_rows(rows)

        # Should detect early departure
        assert len(results) == 1
        assert results[0]["pattern_type"] == "early_departure"


class TestEarlyDepartureNoDetection:
    """Detection MUST NOT occur when fewer than 3 sessions have actual < 50% scheduled."""

    @given(
        short_sessions=st.lists(
            short_session_strategy(), min_size=0, max_size=2
        ),
        long_sessions=st.lists(
            long_session_strategy(), min_size=0, max_size=15
        ),
    )
    @settings(max_examples=200)
    def test_no_detection_when_fewer_than_three_short_sessions(
        self, short_sessions, long_sessions
    ):
        rows = short_sessions + long_sessions
        results = run_detector_with_rows(rows)

        # Should NOT detect early departure
        assert len(results) == 0


class TestEarlyDepartureScoreBounded:
    """Score is always in [0.0, 1.0] regardless of input."""

    @given(
        sessions=st.lists(
            valid_session_strategy(), min_size=3, max_size=50
        )
    )
    @settings(max_examples=200)
    def test_score_always_in_valid_range(self, sessions):
        # Ensure at least 3 short sessions to get a result
        short_count = count_short_sessions(sessions)
        assume(short_count >= 3)

        results = run_detector_with_rows(sessions)

        assert len(results) == 1
        score = results[0]["score"]
        assert 0.0 <= score <= 1.0


class TestEarlyDepartureScoreFormula:
    """Score formula: min(1.0, short_session_count / 6.0)."""

    @given(
        short_sessions=st.lists(
            short_session_strategy(), min_size=3, max_size=20
        ),
        long_sessions=st.lists(
            long_session_strategy(), min_size=0, max_size=10
        ),
    )
    @settings(max_examples=200)
    def test_score_matches_formula(self, short_sessions, long_sessions):
        rows = short_sessions + long_sessions
        short_count = len(short_sessions)

        results = run_detector_with_rows(rows)

        assert len(results) == 1
        expected_score = min(1.0, short_count / 6.0)
        # Allow for rounding (detector uses round(..., 4))
        assert abs(results[0]["score"] - expected_score) < 0.001


class TestEarlyDepartureSkipsInvalidSessions:
    """Sessions with scheduled_minutes <= 0 or actual_minutes is None are skipped."""

    @given(
        invalid_sessions=st.lists(
            st.one_of(
                # scheduled <= 0
                st.fixed_dictionaries(
                    {
                        "actual_minutes": st.integers(min_value=0, max_value=100),
                        "scheduled_minutes": st.integers(min_value=-10, max_value=0),
                    }
                ),
                # actual is None
                st.fixed_dictionaries(
                    {
                        "actual_minutes": st.none(),
                        "scheduled_minutes": st.integers(min_value=1, max_value=100),
                    }
                ),
            ),
            min_size=1,
            max_size=10,
        ),
        long_sessions=st.lists(
            long_session_strategy(), min_size=1, max_size=5
        ),
    )
    @settings(max_examples=200)
    def test_invalid_sessions_do_not_count(self, invalid_sessions, long_sessions):
        # Only invalid sessions + long sessions -> no detection
        rows = invalid_sessions + long_sessions
        results = run_detector_with_rows(rows)

        # Invalid sessions should be skipped, only long sessions remain
        # which are NOT short, so no detection
        assert len(results) == 0
