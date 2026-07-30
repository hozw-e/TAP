"""Unit tests for Alert dataclass."""

from unittest.mock import MagicMock, patch

from src.models.alert import Alert


class TestAlertDataclass:
    """Tests for Alert dataclass creation and serialization."""

    def test_create_alert(self):
        alert = Alert(
            student_id=1,
            student_name="Juan",
            pattern_type="chronic_tardiness",
            score=0.75,
            description="Juan has been late to 7 of the last 10 sessions",
            detected_at="2024-01-15T10:30:00",
        )
        assert alert.student_id == 1
        assert alert.student_name == "Juan"
        assert alert.pattern_type == "chronic_tardiness"
        assert alert.score == 0.75
        assert alert.detected_at == "2024-01-15T10:30:00"

    def test_to_dict(self):
        alert = Alert(
            student_id=2,
            student_name="Maria",
            pattern_type="attendance_dropoff",
            score=0.85,
            description="Maria's attendance has dropped 85% in the last 7 days",
            detected_at="2024-01-15T11:00:00",
        )
        result = alert.to_dict()
        assert result == {
            "student_id": 2,
            "student_name": "Maria",
            "pattern_type": "attendance_dropoff",
            "score": 0.85,
            "description": "Maria's attendance has dropped 85% in the last 7 days",
            "detected_at": "2024-01-15T11:00:00",
        }

    @patch("src.models.alert.get_connection")
    def test_persist_to_db(self, mock_get_connection):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_connection.return_value = mock_conn

        alert = Alert(
            student_id=1,
            student_name="Juan",
            pattern_type="chronic_tardiness",
            score=0.75,
            description="Juan has been late to 7 of the last 10 sessions",
            detected_at="2024-01-15T10:30:00",
        )
        alert.persist_to_db()

        mock_get_connection.assert_called_once()
        mock_conn.cursor.assert_called_once()
        mock_cursor.execute.assert_called_once()

        # Verify the SQL and params
        call_args = mock_cursor.execute.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        assert "INSERT INTO anomaly_alerts" in sql
        assert params == (1, "chronic_tardiness", 0.75, "Juan has been late to 7 of the last 10 sessions", "2024-01-15T10:30:00")

        mock_conn.commit.assert_called_once()
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()
