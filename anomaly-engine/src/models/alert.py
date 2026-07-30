"""Alert data class with database persistence.

Represents an anomaly alert and provides persistence to the anomaly_alerts table.
"""

from dataclasses import dataclass

from src.db.connection import get_connection


@dataclass
class Alert:
    """Represents a detected anomaly alert for a student.

    Attributes:
        student_id: The student's database ID.
        student_name: The student's display name.
        pattern_type: One of 'chronic_tardiness', 'attendance_dropoff',
                      'irregular_timing', 'early_departure'.
        score: Anomaly score between 0.0 and 1.0.
        description: Plain-language description of the anomaly.
        detected_at: ISO 8601 timestamp of detection.
    """

    student_id: int
    student_name: str
    pattern_type: str
    score: float
    description: str
    detected_at: str  # ISO 8601

    def persist_to_db(self):
        """Insert this alert into the anomaly_alerts table.

        Uses the connection pool from src.db.connection. The connection
        is returned to the pool after the operation completes.
        """
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO anomaly_alerts "
            "(student_id, pattern_type, score, description, detected_at) "
            "VALUES (%s, %s, %s, %s, %s)",
            (
                self.student_id,
                self.pattern_type,
                self.score,
                self.description,
                self.detected_at,
            ),
        )
        conn.commit()
        cursor.close()
        conn.close()

    def to_dict(self) -> dict:
        """Convert the alert to a dictionary for JSON serialization."""
        return {
            "student_id": self.student_id,
            "student_name": self.student_name,
            "pattern_type": self.pattern_type,
            "score": self.score,
            "description": self.description,
            "detected_at": self.detected_at,
        }
