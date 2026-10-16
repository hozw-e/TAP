"""Unit tests for the description generator."""

from src.utils.description_generator import generate_description


class TestChronicTardinessDescription:
    """Tests for chronic tardiness descriptions."""

    def test_contains_student_name(self):
        desc = generate_description(
            "chronic_tardiness",
            "Juan",
            tardy_count=7,
            total_records=10,
            window_days=30,
        )
        assert "Juan" in desc

    def test_contains_tardy_count(self):
        desc = generate_description(
            "chronic_tardiness",
            "Juan",
            tardy_count=7,
            total_records=10,
            window_days=30,
        )
        assert "7" in desc

    def test_contains_total_records(self):
        desc = generate_description(
            "chronic_tardiness",
            "Juan",
            tardy_count=7,
            total_records=10,
            window_days=30,
        )
        assert "10" in desc

    def test_contains_window_days(self):
        desc = generate_description(
            "chronic_tardiness",
            "Maria",
            tardy_count=3,
            total_records=5,
            window_days=14,
        )
        assert "14" in desc


class TestAttendanceDropoffDescription:
    """Tests for attendance dropoff descriptions."""

    def test_contains_student_name(self):
        desc = generate_description(
            "attendance_dropoff",
            "Maria",
            drop_percentage=85,
            days=7,
        )
        assert "Maria" in desc

    def test_contains_drop_percentage(self):
        desc = generate_description(
            "attendance_dropoff",
            "Maria",
            drop_percentage=85,
            days=7,
        )
        assert "85" in desc

    def test_contains_days(self):
        desc = generate_description(
            "attendance_dropoff",
            "Pedro",
            drop_percentage=60,
            days=7,
        )
        assert "7" in desc


class TestCourseDelayDescription:
    """Tests for course delay descriptions."""

    def test_contains_student_name(self):
        desc = generate_description(
            "course_delay",
            "Ana",
            course="Rover 2",
            sessions_used=1,
            max_sessions=4,
            expected_sessions=3,
            shortfall=2,
        )
        assert "Ana" in desc

    def test_contains_course(self):
        desc = generate_description(
            "course_delay",
            "Ana",
            course="Rover 2",
            sessions_used=1,
            max_sessions=4,
            expected_sessions=3,
            shortfall=2,
        )
        assert "Rover 2" in desc

    def test_contains_sessions_used_and_max(self):
        desc = generate_description(
            "course_delay",
            "Ana",
            course="Rover 2",
            sessions_used=1,
            max_sessions=4,
            expected_sessions=3,
            shortfall=2,
        )
        assert "1" in desc
        assert "4" in desc

    def test_contains_shortfall(self):
        desc = generate_description(
            "course_delay",
            "Ana",
            course="Rover 2",
            sessions_used=1,
            max_sessions=4,
            expected_sessions=3,
            shortfall=2,
        )
        assert "2" in desc


class TestUnknownPatternType:
    """Tests for unknown pattern types."""

    def test_unknown_pattern_returns_generic_description(self):
        desc = generate_description("unknown_pattern", "Carlos")
        assert "Carlos" in desc

    def test_unknown_pattern_mentions_attendance(self):
        desc = generate_description("unknown_pattern", "Carlos")
        assert "attendance pattern" in desc
