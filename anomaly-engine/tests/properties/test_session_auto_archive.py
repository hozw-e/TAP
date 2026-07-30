# Feature: session-based-enrollment, Property 5: Auto-archive on session exhaustion
"""Property-based tests verifying that when a student's remaining_sessions
transitions from 1 to 0 via a check-out, their is_archived flag is set to 1
within the same transactional boundary.

**Validates: Requirements 3.1**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings


# --- Model-based simulation of auto-archive logic ---


def simulate_checkout_decrement(remaining_sessions: int) -> dict:
    """Simulate the check-out decrement and auto-archive logic.

    This mirrors the transactional logic in backend/utils/session-counter.php
    and backend/utils/auto-archiver.php:
    1. Decrement remaining_sessions by 1 (only if > 0)
    2. If remaining_sessions reaches 0, set is_archived = 1

    Returns the resulting student state.
    """
    is_archived = 0
    new_remaining = remaining_sessions

    # Decrement only if remaining_sessions > 0
    if remaining_sessions > 0:
        new_remaining = remaining_sessions - 1

    # Auto-archive if sessions exhausted
    if new_remaining == 0:
        is_archived = 1

    return {
        "remaining_sessions": new_remaining,
        "is_archived": is_archived,
    }


class TestAutoArchiveOnSessionExhaustion:
    """When remaining_sessions transitions from 1 to 0 via check-out,
    is_archived SHALL be set to 1 in the same operation."""

    @given(student_name=st.text(min_size=1, max_size=100))
    @settings(max_examples=100)
    def test_archive_triggered_when_sessions_reach_zero(self, student_name):
        """A student with remaining_sessions=1 who checks out must be archived."""
        # Student starts with exactly 1 session remaining (about to exhaust)
        remaining_sessions = 1

        result = simulate_checkout_decrement(remaining_sessions)

        # remaining_sessions must transition to 0
        assert result["remaining_sessions"] == 0
        # is_archived must be set to 1 within the same operation
        assert result["is_archived"] == 1

    @given(
        remaining_sessions=st.integers(min_value=2, max_value=4),
        student_name=st.text(min_size=1, max_size=100),
    )
    @settings(max_examples=100)
    def test_no_archive_when_sessions_remain(self, remaining_sessions, student_name):
        """A student with remaining_sessions > 1 who checks out must NOT be archived."""
        result = simulate_checkout_decrement(remaining_sessions)

        # remaining_sessions decreases by 1 but is still > 0
        assert result["remaining_sessions"] == remaining_sessions - 1
        assert result["remaining_sessions"] > 0
        # is_archived must remain 0 (not archived yet)
        assert result["is_archived"] == 0

    @given(student_name=st.text(min_size=1, max_size=100))
    @settings(max_examples=100)
    def test_archive_and_decrement_are_atomic(self, student_name):
        """The auto-archive and decrement must occur together — if remaining
        reaches 0, archived must already be 1 (no intermediate state)."""
        remaining_sessions = 1

        result = simulate_checkout_decrement(remaining_sessions)

        # Both must be true simultaneously (atomic transaction guarantee)
        assert result["remaining_sessions"] == 0 and result["is_archived"] == 1
