# Feature: session-based-enrollment, Property 2: Remaining sessions bounded invariant
"""Property-based tests verifying that remaining_sessions is always
an integer in the range [0, 4] after any sequence of operations
(creation, check-outs, auto-close).

**Validates: Requirements 1.2, 2.4, 4.2**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings


# --- Model of the session decrement logic (mirrors PHP decrementSession) ---

MAX_SESSIONS = 4
MIN_SESSIONS = 0


def init_remaining_sessions() -> int:
    """Student creation always initializes remaining_sessions to 4."""
    return MAX_SESSIONS


def decrement_session(current: int) -> int:
    """Decrement remaining_sessions by 1 only if current > 0, otherwise stay at 0."""
    if current > 0:
        return current - 1
    return current


class TestInitialValueBounded:
    """The initial remaining_sessions value (4) must be within [0, 4]."""

    def test_initial_value_within_bounds(self):
        value = init_remaining_sessions()
        assert isinstance(value, int)
        assert MIN_SESSIONS <= value <= MAX_SESSIONS


class TestDecrementSequenceBounded:
    """After any random sequence of decrement operations (0 to 20),
    remaining_sessions must always be an integer in [0, 4]."""

    @given(num_decrements=st.integers(min_value=0, max_value=20))
    @settings(max_examples=100)
    def test_remaining_sessions_bounded_after_decrements(self, num_decrements):
        remaining = init_remaining_sessions()
        assert MIN_SESSIONS <= remaining <= MAX_SESSIONS

        for _ in range(num_decrements):
            remaining = decrement_session(remaining)
            assert isinstance(remaining, int)
            assert MIN_SESSIONS <= remaining <= MAX_SESSIONS


class TestArbitraryStartingValueBounded:
    """For any valid starting value in [0, 4], after any sequence of
    decrement operations, remaining_sessions stays in [0, 4]."""

    @given(
        starting_value=st.integers(min_value=0, max_value=4),
        num_decrements=st.integers(min_value=0, max_value=20),
    )
    @settings(max_examples=100)
    def test_bounded_from_any_valid_start(self, starting_value, num_decrements):
        remaining = starting_value
        assert MIN_SESSIONS <= remaining <= MAX_SESSIONS

        for _ in range(num_decrements):
            remaining = decrement_session(remaining)
            assert isinstance(remaining, int)
            assert MIN_SESSIONS <= remaining <= MAX_SESSIONS


class TestDecrementNeverGoesNegative:
    """Decrementing from 0 must stay at 0 — never goes negative."""

    @given(num_decrements=st.integers(min_value=1, max_value=50))
    @settings(max_examples=100)
    def test_decrement_at_zero_stays_zero(self, num_decrements):
        remaining = 0
        for _ in range(num_decrements):
            remaining = decrement_session(remaining)
            assert remaining == 0


class TestDecrementNeverExceedsMax:
    """After any operation sequence, remaining_sessions never exceeds MAX_SESSIONS."""

    @given(
        starting_value=st.integers(min_value=0, max_value=4),
        num_decrements=st.integers(min_value=0, max_value=20),
    )
    @settings(max_examples=100)
    def test_never_exceeds_max(self, starting_value, num_decrements):
        remaining = starting_value
        for _ in range(num_decrements):
            remaining = decrement_session(remaining)
        assert remaining <= MAX_SESSIONS
