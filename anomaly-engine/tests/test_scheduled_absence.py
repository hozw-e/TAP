"""Unit tests for the scheduled-absence detector.

The detector reconstructs the dates a course was scheduled to meet from
course_schedules and compares them against the days a student actually checked
in. These tests drive the three cursor queries it issues, in order:
    1. student row (name, course, enrolled_at)
    2. schedule rows (day_of_week per weekly meeting)
    3. attended distinct dates (time_in IS NOT NULL)
by setting cursor.fetchone / cursor.fetchall side effects accordingly.
"""

import sys
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.detectors.base import BaseDetector
from src.detectors.scheduled_absence import ScheduledAbsenceDetector
from tests.conftest import make_connection_mock


# Day-name of a date, for building schedules that line up with real calendar
# days relative to "today" so the detector enumerates the sessions we expect.
_DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def _day_name(d):
    return _DAY_NAMES[d.weekday()]


class TestScheduledAbsenceDetector:
    """Tests for the scheduled-absence detector."""

    def setup_method(self):
        self.detector = ScheduledAbsenceDetector()
        self.event = {
            "student_id": 1,
            "student_name": "Kyllian Mbappe",
            "action": "check_in",
            "timestamp": "2026-10-17T15:00:00",
            "course": "Arduino",
            "attendance_flag": None,
        }
        self.config = {
            "alert_threshold": 0.7,
            "historical_window_days": 30,
            "enabled_patterns": ["scheduled_absence"],
        }

    def _wire(self, mock_conn, student_row, schedule_rows, attended_rows):
        """Wire the mock cursor to answer the detector's three queries."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = student_row
        # Two fetchall calls: schedules first, then attended dates.
        mock_cursor.fetchall.side_effect = [schedule_rows, attended_rows]
        mock_conn.return_value.cursor.return_value = mock_cursor
        return mock_cursor

    # ---- contract ----------------------------------------------------- #

    def test_is_subclass_of_base_detector(self):
        assert issubclass(ScheduledAbsenceDetector, BaseDetector)

    def test_pattern_type(self):
        assert self.detector.PATTERN_TYPE == "scheduled_absence"

    def test_default_thresholds(self):
        assert self.detector.CONSECUTIVE_THRESHOLD == 2
        assert self.detector.RATIO_THRESHOLD == 0.5

    # ---- early exits -------------------------------------------------- #

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_returns_empty_when_student_missing(self, mock_conn):
        self._wire(mock_conn, None, [], [])
        assert self.detector.detect(1, self.event, self.config) == []

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_returns_empty_when_no_course(self, mock_conn):
        enrolled = datetime.now() - timedelta(days=60)
        self._wire(
            mock_conn,
            {"student_name": "No Course", "student_course": None, "enrolled_at": enrolled},
            [],
            [],
        )
        assert self.detector.detect(1, self.event, self.config) == []

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_returns_empty_when_course_has_no_schedule(self, mock_conn):
        """Courses with no course_schedules rows cannot be judged -> no alert."""
        enrolled = datetime.now() - timedelta(days=60)
        self._wire(
            mock_conn,
            {"student_name": "Treize", "student_course": "Robotics", "enrolled_at": enrolled},
            [],  # no schedule rows
            [],
        )
        assert self.detector.detect(1, self.event, self.config) == []

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_returns_empty_within_grace_period(self, mock_conn):
        """A student enrolled a few days ago is still inside the grace window."""
        enrolled = datetime.now() - timedelta(days=3)
        today = date.today()
        self._wire(
            mock_conn,
            {"student_name": "New Student", "student_course": "Arduino", "enrolled_at": enrolled},
            [{"day_of_week": _day_name(today)}],
            [],
        )
        assert self.detector.detect(1, self.event, self.config) == []

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_returns_empty_on_db_error(self, mock_conn):
        mock_conn.side_effect = Exception("boom")
        assert self.detector.detect(1, self.event, self.config) == []

    # ---- positive detections ------------------------------------------ #

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_flags_consecutive_misses(self, mock_conn):
        """Enrolled long ago, scheduled weekly, attended nothing -> flagged."""
        enrolled = datetime.now() - timedelta(days=60)
        today = date.today()
        # Schedule the course on today's weekday so several sessions have come
        # due over the window; the student attended none of them.
        self._wire(
            mock_conn,
            {"student_name": "Kyllian Mbappe", "student_course": "Arduino", "enrolled_at": enrolled},
            [{"day_of_week": _day_name(today)}],
            [],  # attended no dates
        )

        result = self.detector.detect(1, self.event, self.config)

        assert len(result) == 1
        alert = result[0]
        assert alert["pattern_type"] == "scheduled_absence"
        assert alert["student_id"] == 1
        assert alert["student_name"] == "Kyllian Mbappe"
        assert alert["score"] >= 0.5
        assert "Arduino" in alert["description"]
        assert "detected_at" in alert

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_not_flagged_when_fully_attended(self, mock_conn):
        """Attending every scheduled session yields no alert."""
        enrolled = datetime.now() - timedelta(days=60)
        today = date.today()
        weekday_name = _day_name(today)

        # Build the exact set of scheduled dates the detector will enumerate and
        # mark them all attended.
        grace_start = enrolled.date() + timedelta(weeks=1)
        window_start = today - timedelta(days=30)
        start = max(grace_start, window_start)
        attended = []
        d = start
        while d <= today:
            if _day_name(d) == weekday_name:
                attended.append({"date": d})
            d += timedelta(days=1)

        self._wire(
            mock_conn,
            {"student_name": "Perfect", "student_course": "Arduino", "enrolled_at": enrolled},
            [{"day_of_week": weekday_name}],
            attended,
        )

        assert self.detector.detect(1, self.event, self.config) == []

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_score_higher_for_longer_streak(self, mock_conn):
        """More consecutive misses produce a higher score (streak signal)."""
        enrolled = datetime.now() - timedelta(days=90)
        today = date.today()
        self._wire(
            mock_conn,
            {"student_name": "Streaky", "student_course": "Arduino", "enrolled_at": enrolled},
            [{"day_of_week": _day_name(today)}],
            [],
        )
        result = self.detector.detect(1, self.event, self.config)
        assert len(result) == 1
        # 4+ consecutive missed weekly sessions saturates the streak signal.
        assert result[0]["score"] == pytest.approx(1.0)

    @patch("src.detectors.scheduled_absence.connection", new_callable=make_connection_mock)
    def test_falls_back_to_event_name(self, mock_conn):
        """Uses event student_name when the student row omits it."""
        enrolled = datetime.now() - timedelta(days=60)
        today = date.today()
        self._wire(
            mock_conn,
            {"student_name": None, "student_course": "Arduino", "enrolled_at": enrolled},
            [{"day_of_week": _day_name(today)}],
            [],
        )
        result = self.detector.detect(1, self.event, self.config)
        assert len(result) == 1
        assert result[0]["student_name"] == "Kyllian Mbappe"
