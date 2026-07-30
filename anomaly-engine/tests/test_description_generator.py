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


class TestIrregularTimingDescription:
    """Tests for irregular timing descriptions."""

    def test_contains_student_name(self):
        desc = generate_description(
            "irregular_timing",
            "Pedro",
            check_in_time="10:30 AM",
            usual_time="8:00 AM",
            deviation_hours=2.5,
            day_of_week="Monday",
            course="Arduino",
        )
        assert "Pedro" in desc

    def test_contains_check_in_time(self):
        desc = generate_description(
            "irregular_timing",
            "Pedro",
            check_in_time="10:30 AM",
            usual_time="8:00 AM",
            deviation_hours=2.5,
            day_of_week="Monday",
            course="Arduino",
        )
        assert "10:30 AM" in desc

    def test_contains_usual_time(self):
        desc = generate_description(
            "irregular_timing",
            "Pedro",
            check_in_time="10:30 AM",
            usual_time="8:00 AM",
            deviation_hours=2.5,
            day_of_week="Monday",
            course="Arduino",
        )
        assert "8:00 AM" in desc

    def test_contains_deviation(self):
        desc = generate_description(
            "irregular_timing",
            "Pedro",
            check_in_time="10:30 AM",
            usual_time="8:00 AM",
            deviation_hours=2.5,
            day_of_week="Monday",
            course="Arduino",
        )
        assert "2.5" in desc

    def test_contains_course_and_day(self):
        desc = generate_description(
            "irregular_timing",
            "Pedro",
            check_in_time="10:30 AM",
            usual_time="8:00 AM",
            deviation_hours=2.5,
            day_of_week="Monday",
            course="Arduino",
        )
        assert "Monday" in desc
        assert "Arduino" in desc


class TestEarlyDepartureDescription:
    """Tests for early departure descriptions."""

    def test_contains_student_name(self):
        desc = generate_description(
            "early_departure",
            "Ana",
            short_count=4,
            total_sessions=6,
            threshold_percentage=50,
        )
        assert "Ana" in desc

    def test_contains_short_count(self):
        desc = generate_description(
            "early_departure",
            "Ana",
            short_count=4,
            total_sessions=6,
            threshold_percentage=50,
        )
        assert "4" in desc

    def test_contains_total_sessions(self):
        desc = generate_description(
            "early_departure",
            "Ana",
            short_count=4,
            total_sessions=6,
            threshold_percentage=50,
        )
        assert "6" in desc

    def test_contains_threshold_percentage(self):
        desc = generate_description(
            "early_departure",
            "Ana",
            short_count=4,
            total_sessions=6,
            threshold_percentage=50,
        )
        assert "50%" in desc


class TestUnknownPatternType:
    """Tests for unknown pattern types."""

    def test_unknown_pattern_returns_generic_description(self):
        desc = generate_description("unknown_pattern", "Carlos")
        assert "Carlos" in desc

    def test_unknown_pattern_mentions_attendance(self):
        desc = generate_description("unknown_pattern", "Carlos")
        assert "attendance pattern" in desc
