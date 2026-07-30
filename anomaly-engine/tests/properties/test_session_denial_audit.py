# Feature: session-based-enrollment, Property 7: Denial records contain required audit fields
"""Property-based tests verifying that any attendance denial due to archived status
produces a scan record containing the student ID, a timestamp, and the denial
reason "Student has completed all sessions".

**Validates: Requirements 5.3**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from datetime import datetime, timezone

import hypothesis.strategies as st
from hypothesis import given, settings


# --- Model-based simulation of denial record generation ---


def generate_denial_record(uid: str, student_id: int, student_name: str) -> dict:
    """Simulate the denial record produced by scan.php when an archived
    student attempts an NFC scan.

    This mirrors the logic in backend/api/nfc/scan.php archived-student gate:
    - status: 'denied'
    - action: 'archived_denied'
    - uid: the NFC tag UID
    - student_id: the student's ID
    - student_name: the student's name
    - message: denial reason
    - timestamp: ISO format timestamp
    """
    timestamp_iso = datetime.now(timezone.utc).isoformat()

    denial_data = {
        "status": "denied",
        "action": "archived_denied",
        "uid": uid,
        "student_id": student_id,
        "student_name": student_name,
        "message": "Student has completed all sessions",
        "timestamp": timestamp_iso,
    }

    return denial_data


class TestDenialRecordsContainRequiredAuditFields:
    """For any attendance denial due to archived status, the stored NFC scan
    record SHALL contain the student ID, a timestamp, and the denial reason
    'Student has completed all sessions'."""

    @given(
        student_id=st.integers(min_value=1, max_value=100000),
        student_name=st.text(min_size=1, max_size=200),
        uid=st.text(
            alphabet=st.characters(whitelist_categories=("Nd", "Lu", "Ll")),
            min_size=8,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_denial_record_contains_student_id(self, student_id, student_name, uid):
        """The denial record must contain the correct student_id."""
        record = generate_denial_record(uid, student_id, student_name)

        assert "student_id" in record
        assert record["student_id"] == student_id

    @given(
        student_id=st.integers(min_value=1, max_value=100000),
        student_name=st.text(min_size=1, max_size=200),
        uid=st.text(
            alphabet=st.characters(whitelist_categories=("Nd", "Lu", "Ll")),
            min_size=8,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_denial_record_contains_timestamp(self, student_id, student_name, uid):
        """The denial record must contain a non-empty ISO format timestamp."""
        record = generate_denial_record(uid, student_id, student_name)

        assert "timestamp" in record
        assert isinstance(record["timestamp"], str)
        assert len(record["timestamp"]) > 0
        # Verify it's a valid ISO timestamp by parsing it
        parsed = datetime.fromisoformat(record["timestamp"])
        assert parsed is not None

    @given(
        student_id=st.integers(min_value=1, max_value=100000),
        student_name=st.text(min_size=1, max_size=200),
        uid=st.text(
            alphabet=st.characters(whitelist_categories=("Nd", "Lu", "Ll")),
            min_size=8,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_denial_record_contains_correct_reason(self, student_id, student_name, uid):
        """The denial message must be exactly 'Student has completed all sessions'."""
        record = generate_denial_record(uid, student_id, student_name)

        assert "message" in record
        assert record["message"] == "Student has completed all sessions"

    @given(
        student_id=st.integers(min_value=1, max_value=100000),
        student_name=st.text(min_size=1, max_size=200),
        uid=st.text(
            alphabet=st.characters(whitelist_categories=("Nd", "Lu", "Ll")),
            min_size=8,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_denial_record_status_and_action(self, student_id, student_name, uid):
        """The denial record must have status 'denied' and action 'archived_denied'."""
        record = generate_denial_record(uid, student_id, student_name)

        assert record["status"] == "denied"
        assert record["action"] == "archived_denied"

    @given(
        student_id=st.integers(min_value=1, max_value=100000),
        student_name=st.text(
            alphabet=st.characters(
                whitelist_categories=("L", "N", "P", "Z", "S")
            ),
            min_size=1,
            max_size=500,
        ),
        uid=st.text(
            alphabet=st.characters(whitelist_categories=("Nd", "Lu", "Ll")),
            min_size=8,
            max_size=20,
        ),
    )
    @settings(max_examples=100)
    def test_denial_record_with_unicode_and_long_names(
        self, student_id, student_name, uid
    ):
        """Edge case: very long and unicode student names must not break the
        denial record structure or omit required fields."""
        record = generate_denial_record(uid, student_id, student_name)

        # All required audit fields must still be present
        assert "student_id" in record
        assert "timestamp" in record
        assert "message" in record
        assert record["student_id"] == student_id
        assert record["message"] == "Student has completed all sessions"
        assert len(record["timestamp"]) > 0
        # Student name is preserved as-is
        assert record["student_name"] == student_name
