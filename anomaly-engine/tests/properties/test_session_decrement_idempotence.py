# Feature: session-based-enrollment, Property 4: Decrement idempotence per attendance record
"""Property-based tests verifying that a student's remaining_sessions is
decremented at most once per attendance record, regardless of how many times
the decrement operation is invoked for that record (retries, auto-close
re-processing).

**Validates: Requirements 2.3**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings


class SessionCounter:
    """Model-based simulation of the PHP session-counter logic.

    Mirrors the behavior of backend/utils/session-counter.php:
    - isSessionDecremented checks the idempotency flag for an attendance record
    - decrementSession decrements remaining_sessions by 1 only if:
      (a) remaining_sessions > 0, AND
      (b) session_decremented is FALSE for the given attendance record
    - After a successful decrement, session_decremented is set to TRUE
    """

    def __init__(self, remaining_sessions: int):
        self.remaining_sessions = remaining_sessions
        # Maps attendance_id -> bool (whether session_decremented flag is set)
        self.decremented_flags: dict[int, bool] = {}

    def is_session_decremented(self, attendance_id: int) -> bool:
        """Check if a session has already been decremented for an attendance record."""
        return self.decremented_flags.get(attendance_id, False)

    def decrement_session(self, attendance_id: int) -> int:
        """Decrement remaining_sessions following the idempotency guard logic.

        Returns the current remaining_sessions value after the operation.
        """
        # Idempotency guard: if already decremented for this record, return current value
        if self.is_session_decremented(attendance_id):
            return self.remaining_sessions

        # Only decrement if remaining_sessions > 0
        if self.remaining_sessions > 0:
            self.remaining_sessions -= 1

        # Mark the attendance record as decremented (even if remaining was 0)
        self.decremented_flags[attendance_id] = True

        return self.remaining_sessions


class TestDecrementIdempotencePerAttendanceRecord:
    """For any attendance record, regardless of how many times the decrement
    operation is invoked for that record, the student's remaining_sessions
    SHALL be decremented at most once from its value at the time of the first
    successful decrement."""

    @given(
        initial_sessions=st.integers(min_value=0, max_value=4),
        num_invocations=st.integers(min_value=1, max_value=10),
        attendance_id=st.integers(min_value=1, max_value=10000),
    )
    @settings(max_examples=100)
    def test_repeated_decrement_same_record_changes_value_at_most_once(
        self, initial_sessions, num_invocations, attendance_id
    ):
        """Invoking decrementSession N times for the same attendance_id must
        result in remaining_sessions being decremented at most once."""
        counter = SessionCounter(initial_sessions)

        # Invoke decrement N times for the same attendance record
        results = []
        for _ in range(num_invocations):
            result = counter.decrement_session(attendance_id)
            results.append(result)

        # The final value should be decremented by at most 1
        if initial_sessions > 0:
            # Should be decremented by exactly 1
            assert counter.remaining_sessions == initial_sessions - 1
        else:
            # Cannot go below 0
            assert counter.remaining_sessions == 0

        # All results after the first should be identical (idempotent)
        assert all(r == results[0] for r in results)

    @given(
        initial_sessions=st.integers(min_value=0, max_value=4),
        num_invocations=st.integers(min_value=2, max_value=10),
        attendance_id=st.integers(min_value=1, max_value=10000),
    )
    @settings(max_examples=100)
    def test_idempotency_flag_set_after_first_invocation(
        self, initial_sessions, num_invocations, attendance_id
    ):
        """After the first invocation of decrementSession, the
        session_decremented flag must be TRUE for that attendance record."""
        counter = SessionCounter(initial_sessions)

        # First invocation
        counter.decrement_session(attendance_id)
        assert counter.is_session_decremented(attendance_id) is True

        # Subsequent invocations should not alter the flag state
        for _ in range(num_invocations - 1):
            counter.decrement_session(attendance_id)
            assert counter.is_session_decremented(attendance_id) is True

    @given(
        initial_sessions=st.integers(min_value=1, max_value=4),
        attendance_id_1=st.integers(min_value=1, max_value=5000),
        attendance_id_2=st.integers(min_value=5001, max_value=10000),
        retries_1=st.integers(min_value=1, max_value=5),
        retries_2=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100)
    def test_different_records_decrement_independently(
        self, initial_sessions, attendance_id_1, attendance_id_2, retries_1, retries_2
    ):
        """Idempotency is per attendance record — different records should each
        be able to trigger exactly one decrement."""
        counter = SessionCounter(initial_sessions)

        # Process first attendance record with retries
        for _ in range(retries_1):
            counter.decrement_session(attendance_id_1)

        value_after_first = counter.remaining_sessions

        # Process second attendance record with retries
        for _ in range(retries_2):
            counter.decrement_session(attendance_id_2)

        # First record should have decremented once (initial > 0)
        assert value_after_first == initial_sessions - 1

        # Second record should decrement once more (if value_after_first > 0)
        if value_after_first > 0:
            assert counter.remaining_sessions == value_after_first - 1
        else:
            assert counter.remaining_sessions == 0

    @given(
        initial_sessions=st.integers(min_value=0, max_value=4),
        num_invocations=st.integers(min_value=1, max_value=10),
        attendance_id=st.integers(min_value=1, max_value=10000),
    )
    @settings(max_examples=100)
    def test_remaining_sessions_never_negative_after_retries(
        self, initial_sessions, num_invocations, attendance_id
    ):
        """No matter how many times decrement is retried for the same record,
        remaining_sessions must never go below 0."""
        counter = SessionCounter(initial_sessions)

        for _ in range(num_invocations):
            counter.decrement_session(attendance_id)

        assert counter.remaining_sessions >= 0
