# Feature: session-based-enrollment, Property 6: Archived students blocked from all attendance actions
"""Property-based tests verifying that any student with is_archived = 1 is denied
all NFC scan attempts (check-in and check-out), and no attendance_logs records
are created or modified for that student.

**Validates: Requirements 3.3, 5.1, 5.2**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from dataclasses import dataclass, field
from typing import List

import hypothesis.strategies as st
from hypothesis import given, settings


# --- Model-based simulation of the archived-student gate ---


@dataclass
class AttendanceRecord:
    """Represents an attendance_logs record."""

    attendance_id: int
    student_id: int
    time_in: str
    time_out: str = ""


@dataclass
class AttendanceSystem:
    """Model of the attendance system tracking attendance_logs records."""

    records: List[AttendanceRecord] = field(default_factory=list)
    next_id: int = 1

    def record_count(self) -> int:
        return len(self.records)

    def get_records_for_student(self, student_id: int) -> List[AttendanceRecord]:
        return [r for r in self.records if r.student_id == student_id]


def attempt_nfc_scan(
    system: AttendanceSystem,
    student_id: int,
    student_name: str,
    is_archived: int,
    scan_type: str,
) -> dict:
    """Simulate an NFC scan attempt against the archived-student gate.

    This mirrors the logic in backend/api/nfc/scan.php:
    - Before any attendance logic, check if is_archived == 1
    - If archived: deny the scan, do NOT create/modify attendance_logs
    - If not archived: proceed with normal check-in or check-out

    Args:
        system: The attendance system model tracking records
        student_id: The student being scanned
        student_name: The student's name
        is_archived: 1 if archived, 0 if active
        scan_type: "check_in" or "check_out"

    Returns:
        dict with 'action' result and whether records were modified
    """
    records_before = system.record_count()

    # Archived-student gate (checked BEFORE any attendance logic)
    if is_archived == 1:
        # Deny — no attendance_logs record created or modified
        return {
            "action": "archived_denied",
            "reason": "Student has completed all sessions",
            "student_id": student_id,
            "records_modified": False,
            "records_before": records_before,
            "records_after": system.record_count(),
        }

    # Non-archived student: normal attendance processing
    if scan_type == "check_in":
        record = AttendanceRecord(
            attendance_id=system.next_id,
            student_id=student_id,
            time_in="2025-01-15 08:00:00",
        )
        system.records.append(record)
        system.next_id += 1
        return {
            "action": "check_in",
            "records_modified": True,
            "records_before": records_before,
            "records_after": system.record_count(),
        }
    else:  # check_out
        # Find open record for this student and close it
        open_records = [
            r
            for r in system.get_records_for_student(student_id)
            if r.time_out == ""
        ]
        if open_records:
            open_records[0].time_out = "2025-01-15 12:00:00"
            return {
                "action": "check_out",
                "records_modified": True,
                "records_before": records_before,
                "records_after": system.record_count(),
            }
        return {
            "action": "no_open_record",
            "records_modified": False,
            "records_before": records_before,
            "records_after": system.record_count(),
        }


class TestArchivedStudentsBlockedFromAttendance:
    """For any student with is_archived = 1, any NFC scan attempt SHALL be denied
    and no attendance_logs records SHALL be created or modified."""

    @given(
        student_id=st.integers(min_value=1, max_value=10000),
        student_name=st.text(min_size=1, max_size=100),
    )
    @settings(max_examples=100)
    def test_archived_student_check_in_denied(self, student_id, student_name):
        """An archived student's check-in scan must be denied."""
        system = AttendanceSystem()
        records_before = system.record_count()

        result = attempt_nfc_scan(
            system=system,
            student_id=student_id,
            student_name=student_name,
            is_archived=1,
            scan_type="check_in",
        )

        # Scan must be denied
        assert result["action"] == "archived_denied"
        # No records created
        assert system.record_count() == records_before
        assert result["records_modified"] is False

    @given(
        student_id=st.integers(min_value=1, max_value=10000),
        student_name=st.text(min_size=1, max_size=100),
    )
    @settings(max_examples=100)
    def test_archived_student_check_out_denied(self, student_id, student_name):
        """An archived student's check-out scan must be denied."""
        system = AttendanceSystem()
        # Pre-populate an open record to simulate a scenario where checkout
        # would normally succeed if the student weren't archived
        system.records.append(
            AttendanceRecord(
                attendance_id=1,
                student_id=student_id,
                time_in="2025-01-15 08:00:00",
                time_out="",
            )
        )
        system.next_id = 2
        records_before = system.record_count()

        result = attempt_nfc_scan(
            system=system,
            student_id=student_id,
            student_name=student_name,
            is_archived=1,
            scan_type="check_out",
        )

        # Scan must be denied
        assert result["action"] == "archived_denied"
        # No records modified (the open record's time_out must remain empty)
        assert system.record_count() == records_before
        assert result["records_modified"] is False
        # Verify the existing record was NOT modified
        existing_record = system.get_records_for_student(student_id)[0]
        assert existing_record.time_out == ""

    @given(
        student_id=st.integers(min_value=1, max_value=10000),
        student_name=st.text(min_size=1, max_size=100),
        scan_type=st.sampled_from(["check_in", "check_out"]),
    )
    @settings(max_examples=100)
    def test_archived_student_no_records_created_or_modified(
        self, student_id, student_name, scan_type
    ):
        """For any scan type, an archived student must not cause any
        attendance_logs record to be created or modified."""
        system = AttendanceSystem()
        # Add some pre-existing records for the student
        system.records.append(
            AttendanceRecord(
                attendance_id=1,
                student_id=student_id,
                time_in="2025-01-15 08:00:00",
                time_out="",
            )
        )
        system.next_id = 2
        records_before = system.record_count()
        # Snapshot existing records state
        original_time_outs = [r.time_out for r in system.records]

        result = attempt_nfc_scan(
            system=system,
            student_id=student_id,
            student_name=student_name,
            is_archived=1,
            scan_type=scan_type,
        )

        # All attempts must be denied
        assert result["action"] == "archived_denied"
        # Record count unchanged (no new records)
        assert system.record_count() == records_before
        # No existing records modified
        current_time_outs = [r.time_out for r in system.records]
        assert current_time_outs == original_time_outs

    @given(
        student_id=st.integers(min_value=1, max_value=10000),
        student_name=st.text(min_size=1, max_size=100),
    )
    @settings(max_examples=100)
    def test_non_archived_student_not_blocked(self, student_id, student_name):
        """A non-archived student (is_archived = 0) must NOT be blocked from
        attendance actions — check-in should succeed normally."""
        system = AttendanceSystem()
        records_before = system.record_count()

        result = attempt_nfc_scan(
            system=system,
            student_id=student_id,
            student_name=student_name,
            is_archived=0,
            scan_type="check_in",
        )

        # Non-archived student must NOT be denied
        assert result["action"] != "archived_denied"
        # A new attendance record should be created
        assert result["action"] == "check_in"
        assert system.record_count() == records_before + 1
        assert result["records_modified"] is True
