"""Unit tests for the attendance dropoff detector."""

import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from src.detectors.attendance_dropoff import AttendanceDropoffDetector


class TestAttendanceDropoffDetector(unittest.TestCase):
    """Test the AttendanceDropoffDetector class."""

    def setUp(self):
        self.detector = AttendanceDropoffDetector()
        self.config = {
            "alert_threshold": 0.7,
            "historical_window_days": 30,
            "enabled_patterns": ["attendance_dropoff"],
        }
        self.event = {
            "student_id": 1,
            "student_name": "Juan Dela Cruz",
            "action": "check_in",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "course": "Arduino",
            "attendance_flag": "present",
        }

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_no_history_returns_empty(self, mock_get_conn):
        """Student with no attendance records returns no alerts."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {"first_date": None}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(result, [])

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_insufficient_history_returns_empty(self, mock_get_conn):
        """Student with less than 14 days history returns no alerts."""
        now = datetime.utcnow()
        # Only 10 days of history
        first_date = (now - timedelta(days=10)).date()

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {"first_date": first_date}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(result, [])

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_no_dropoff_returns_empty(self, mock_get_conn):
        """Student with normal attendance returns no alerts."""
        now = datetime.utcnow()
        first_date = (now - timedelta(days=30)).date()

        mock_cursor = MagicMock()
        # Three cursor.fetchone calls: first_date, total_count, recent_count
        mock_cursor.fetchone.side_effect = [
            {"first_date": first_date},
            {"total_count": 20},  # ~4.67 per week over 30 days
            {"recent_count": 4},  # 4 in last 7 days => ratio ~0.86 > 0.4
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(result, [])

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_significant_dropoff_detected(self, mock_get_conn):
        """Student with significant attendance drop triggers alert."""
        now = datetime.utcnow()
        first_date = (now - timedelta(days=30)).date()

        mock_cursor = MagicMock()
        # 20 total in 30 days = ~4.67/week avg
        # 1 in last 7 days => ratio = 1/4.67 = ~0.214 < 0.4
        mock_cursor.fetchone.side_effect = [
            {"first_date": first_date},
            {"total_count": 20},
            {"recent_count": 1},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(len(result), 1)
        alert = result[0]
        self.assertEqual(alert["student_id"], 1)
        self.assertEqual(alert["student_name"], "Juan Dela Cruz")
        self.assertEqual(alert["pattern_type"], "attendance_dropoff")
        self.assertGreater(alert["score"], 0.0)
        self.assertLessEqual(alert["score"], 1.0)
        self.assertIn("Juan Dela Cruz", alert["description"])
        self.assertIn("detected_at", alert)

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_zero_recent_attendance_max_score(self, mock_get_conn):
        """Student with zero recent attendance gets maximum score."""
        now = datetime.utcnow()
        first_date = (now - timedelta(days=30)).date()

        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            {"first_date": first_date},
            {"total_count": 20},
            {"recent_count": 0},  # zero in last 7 days
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(len(result), 1)
        alert = result[0]
        # dropoff_ratio = 0/4.67 = 0, score = max(0, 1.0 - 0/0.4) = 1.0
        self.assertEqual(alert["score"], 1.0)

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_borderline_ratio_not_detected(self, mock_get_conn):
        """Ratio exactly at 0.4 boundary should not trigger detection."""
        now = datetime.utcnow()
        first_date = (now - timedelta(days=28)).date()

        mock_cursor = MagicMock()
        # 16 total in 28 days = 4/week avg
        # ratio = recent / avg = recent / 4
        # For ratio = 0.4 exactly: recent = 0.4 * 4 = 1.6
        # Since we can't have fractional attendance, use values that give ratio >= 0.4
        # 2 in last 7 days / 4 avg = 0.5 ratio > 0.4 => not detected
        mock_cursor.fetchone.side_effect = [
            {"first_date": first_date},
            {"total_count": 16},
            {"recent_count": 2},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(result, [])

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_score_clamped_between_0_and_1(self, mock_get_conn):
        """Score is always between 0.0 and 1.0."""
        now = datetime.utcnow()
        first_date = (now - timedelta(days=30)).date()

        mock_cursor = MagicMock()
        # Very small dropoff (ratio just under 0.4)
        # 20 total in 30 days = ~4.67/week
        # recent_count = 1 => ratio = 1/4.67 = 0.214
        # score = max(0, 1.0 - 0.214/0.4) = max(0, 1.0 - 0.536) = 0.464
        mock_cursor.fetchone.side_effect = [
            {"first_date": first_date},
            {"total_count": 20},
            {"recent_count": 1},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(len(result), 1)
        self.assertGreaterEqual(result[0]["score"], 0.0)
        self.assertLessEqual(result[0]["score"], 1.0)

    @patch("src.detectors.attendance_dropoff.get_connection")
    def test_db_error_returns_empty(self, mock_get_conn):
        """Database errors are handled gracefully and return empty list."""
        mock_get_conn.side_effect = Exception("Connection failed")

        result = self.detector.detect(1, self.event, self.config)
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
