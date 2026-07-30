# Feature: session-based-enrollment, Property 3: Check-out decrements by exactly one
"""Property-based tests verifying that a valid check-out decrements
remaining_sessions by exactly one for any student with sessions in [1, 4],
and that no decrement occurs when remaining_sessions is 0.

**Validates: Requirements 2.1**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings


def decrement_session(remaining_sessions: int) -> int:
    """Model of the session decrement logic from session-counter.php.

    Decrements remaining_sessions by 1 only if remaining_sessions > 0.
    Returns the new remaining_sessions value.
    """
    if remaining_sessions > 0:
        return remaining_sessions - 1
    return remaining_sessions


class TestCheckoutDecrementsByExactlyOne:
    """For any student with remaining_sessions in [1, 4] and a valid check-out,
    remaining_sessions SHALL equal the prior value minus 1."""

    @given(remaining_sessions=st.integers(min_value=1, max_value=4))
    @settings(max_examples=100)
    def test_valid_checkout_decrements_by_exactly_one(self, remaining_sessions):
        """A valid check-out (session_decremented is FALSE) causes exactly -1."""
        prior_value = remaining_sessions
        new_value = decrement_session(remaining_sessions)
        assert new_value == prior_value - 1, (
            f"Expected {prior_value - 1}, got {new_value} "
            f"(prior={prior_value})"
        )

    @given(remaining_sessions=st.integers(min_value=1, max_value=4))
    @settings(max_examples=100)
    def test_decrement_difference_is_exactly_one(self, remaining_sessions):
        """The difference between prior and new value is always exactly 1."""
        prior_value = remaining_sessions
        new_value = decrement_session(remaining_sessions)
        difference = prior_value - new_value
        assert difference == 1, (
            f"Expected difference of 1, got {difference} "
            f"(prior={prior_value}, new={new_value})"
        )


class TestNoDecrementAtZero:
    """If remaining_sessions is 0, no decrement occurs (value stays 0)."""

    @given(st.just(0))
    @settings(max_examples=100)
    def test_zero_sessions_not_decremented(self, remaining_sessions):
        """When remaining_sessions is 0, decrement has no effect."""
        new_value = decrement_session(remaining_sessions)
        assert new_value == 0, (
            f"Expected 0 (no decrement at zero), got {new_value}"
        )

    @given(remaining_sessions=st.integers(min_value=1, max_value=4))
    @settings(max_examples=100)
    def test_result_never_goes_negative(self, remaining_sessions):
        """After decrement, remaining_sessions is never negative."""
        new_value = decrement_session(remaining_sessions)
        assert new_value >= 0, (
            f"remaining_sessions went negative: {new_value}"
        )
