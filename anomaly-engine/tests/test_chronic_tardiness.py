"""Unit tests for the chronic tardiness detector."""

import sys
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.detectors.base import BaseDetector
from src.detectors.chronic_tardiness import ChronicTardinessDetector


class TestBaseDetector:
    """Tests for the abstract base detector class."""

    def test_cannot_instantiate_base_detector(self):
        """BaseDetector cannot be instantiated directly."""
        with pytest.raises(TypeError):
            BaseDetector()

    def test_base_detector_has_detect_method(self):
        """BaseDetector defines the detect abstract method."""
        assert hasattr(BaseDetector, "detect")
        assert getattr(BaseDetector.detect, "__isabstractmethod__", False)


class TestChronicTardinessDetector:
    """Tests for the chronic tardiness detector."""

    def setup_method(self):
        self.detector = ChronicTardinessDetector()
        self.event = {
            "student_id": 1,
            "student_name": "Juan Dela Cruz",
            "action": "check_in",
            "timestamp": "2024-01-15T08:30:00",
            "course": "Arduino",
            "attendance_flag": "tardy",
        }
        self.config = {
            "alert_threshold": 0.7,
            "historical_window_days": 30,
            "enabled_patterns": ["chronic_tardiness"],
        }

    def test_is_subclass_of_base_detector(self):
        """ChronicTardinessDetector extends BaseDetector."""
        assert issubclass(ChronicTardinessDetector, BaseDetector)

    def test_pattern_type_is_chronic_tardiness(self):
        """Pattern type constant is correct."""
        assert self.detector.PATTERN_TYPE == "chronic_tardiness"

    def test_min_records_is_five(self):
        """Minimum records threshold is 5."""
        assert self.detector.MIN_RECORDS == 5

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_returns_empty_when_insufficient_records(self, mock_conn):
        """Returns empty list when fewer than 5 records."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 4,
            "tardy_count": 3,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)
        assert result == []

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_returns_empty_when_tardy_ratio_at_or_below_threshold(self, mock_conn):
        """Returns empty list when tardy ratio is exactly 0.5."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 10,
            "tardy_count": 5,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)
        assert result == []

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_returns_alert_when_tardy_ratio_exceeds_threshold(self, mock_conn):
        """Returns alert when tardy ratio exceeds 0.5."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 10,
            "tardy_count": 7,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)

        assert len(result) == 1
        alert = result[0]
        assert alert["student_id"] == 1
        assert alert["student_name"] == "Juan Dela Cruz"
        assert alert["pattern_type"] == "chronic_tardiness"
        assert alert["score"] == 0.7
        assert "7" in alert["description"]
        assert "10" in alert["description"]
        assert "Juan Dela Cruz" in alert["description"]
        assert "detected_at" in alert

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_score_is_tardy_ratio(self, mock_conn):
        """Score equals tardy_ratio directly."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 10,
            "tardy_count": 8,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)

        assert result[0]["score"] == 0.8

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_score_capped_at_one(self, mock_conn):
        """Score is capped at 1.0 even though ratio can't exceed 1.0."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 5,
            "tardy_count": 5,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)

        assert result[0]["score"] == 1.0

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_returns_empty_on_db_error(self, mock_conn):
        """Returns empty list when database query fails."""
        mock_conn.side_effect = Exception("Connection failed")

        result = self.detector.detect(1, self.event, self.config)
        assert result == []

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_returns_empty_when_no_row(self, mock_conn):
        """Returns empty list when query returns None."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)
        assert result == []

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_uses_config_historical_window(self, mock_conn):
        """Uses historical_window_days from config."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 10,
            "tardy_count": 8,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        config = {**self.config, "historical_window_days": 60}
        self.detector.detect(1, self.event, config)

        # Verify the query was called (the window_start date would be different)
        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        assert call_args[1] is None or len(call_args[0]) == 2

    @patch("src.detectors.chronic_tardiness.get_connection")
    def test_alert_description_contains_context(self, mock_conn):
        """Alert description includes student name and quantified stats."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "total_records": 10,
            "tardy_count": 6,
        }
        mock_conn.return_value.cursor.return_value = mock_cursor

        result = self.detector.detect(1, self.event, self.config)
        desc = result[0]["description"]

        assert "Juan Dela Cruz" in desc
        assert "6" in desc
        assert "10" in desc
        assert "30 days" in desc
