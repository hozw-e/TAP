"""Chronic tardiness anomaly detector.

Detects students who are consistently arriving late by computing
the ratio of tardy records to total records within the historical window.

Algorithm:
    tardy_ratio = count(attendance_flag == 'tardy') / count(all_records)
    score = tardy_ratio  (directly proportional, capped at 1.0)
    detected = tardy_ratio > 0.5

Minimum 5 records required in the historical window.
"""

import logging
from datetime import datetime, timedelta

from src.db.connection import get_connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)


class ChronicTardinessDetector(BaseDetector):
    """Detects chronic tardiness pattern in student attendance."""

    PATTERN_TYPE = "chronic_tardiness"
    MIN_RECORDS = 5

    def detect(self, student_id, event, config):
        """Analyze student's tardy ratio over the historical window.

        Args:
            student_id: int - the student ID
            event: dict - the attendance event that triggered analysis
            config: dict - config with historical_window_days

        Returns:
            list of alert dicts if tardy_ratio > 0.5, else empty list
        """
        historical_window_days = config.get("historical_window_days", 30)
        window_start = datetime.now() - timedelta(days=historical_window_days)

        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute(
                "SELECT "
                "  COUNT(*) AS total_records, "
                "  SUM(CASE WHEN attendance_flag = 'tardy' THEN 1 ELSE 0 END) AS tardy_count "
                "FROM attendance_logs "
                "WHERE student_id = %s AND session_date >= %s",
                (student_id, window_start.strftime("%Y-%m-%d")),
            )
            row = cursor.fetchone()
            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(
                "ChronicTardinessDetector DB error for student %s: %s",
                student_id,
                e,
            )
            return []

        if row is None:
            return []

        total_records = int(row["total_records"])
        tardy_count = int(row["tardy_count"] or 0)

        # Skip if insufficient history
        if total_records < self.MIN_RECORDS:
            return []

        tardy_ratio = tardy_count / total_records
        score = min(1.0, tardy_ratio)

        # Only generate alert if tardy ratio exceeds threshold
        if tardy_ratio <= 0.5:
            return []

        student_name = event.get("student_name", "Unknown")
        detected_at = datetime.now().isoformat()

        return [
            {
                "student_id": student_id,
                "student_name": student_name,
                "pattern_type": self.PATTERN_TYPE,
                "score": round(score, 4),
                "description": (
                    f"{student_name} has been tardy for {tardy_count} of "
                    f"{total_records} sessions in the last "
                    f"{historical_window_days} days "
                    f"({tardy_ratio:.0%} tardy rate)"
                ),
                "detected_at": detected_at,
            }
        ]
