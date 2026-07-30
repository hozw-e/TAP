"""Attendance dropoff anomaly detector.

Detects when a student's recent attendance frequency drops significantly
compared to their historical average. Requires at least 14 days of history.

Algorithm:
    avg_weekly_frequency = total_attendances / (historical_window_days / 7)
    recent_7day_frequency = attendances_in_last_7_days
    dropoff_ratio = recent_7day_frequency / avg_weekly_frequency
    score = max(0, 1.0 - (dropoff_ratio / 0.4))
    detected = dropoff_ratio < 0.4
"""

import logging
from datetime import datetime, timedelta, timezone

from src.db.connection import get_connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)


class AttendanceDropoffDetector(BaseDetector):
    """Detects significant drops in attendance frequency."""

    PATTERN_TYPE = "attendance_dropoff"
    MIN_HISTORY_DAYS = 14

    def detect(self, student_id, event, config):
        """Analyze attendance frequency for dropoff pattern.

        Args:
            student_id: The student's ID to analyze.
            event: The triggering attendance event dict.
            config: Configuration dict with historical_window_days.

        Returns:
            List of alert dicts if dropoff detected, empty list otherwise.
        """
        historical_window_days = config.get("historical_window_days", 30)

        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

            now = datetime.now(timezone.utc)
            window_start = now - timedelta(days=historical_window_days)
            seven_days_ago = now - timedelta(days=7)

            # Check if student has at least 14 days of history
            cursor.execute(
                "SELECT MIN(session_date) AS first_date "
                "FROM attendance_logs "
                "WHERE student_id = %s AND session_date >= %s",
                (student_id, window_start.date()),
            )
            row = cursor.fetchone()

            if row is None or row["first_date"] is None:
                cursor.close()
                conn.close()
                return []

            first_date = row["first_date"]
            # Ensure first_date is a date object
            if isinstance(first_date, str):
                first_date = datetime.strptime(first_date, "%Y-%m-%d").date()

            days_of_history = (now.date() - first_date).days
            if days_of_history < self.MIN_HISTORY_DAYS:
                cursor.close()
                conn.close()
                return []

            # Count total attendances in the historical window
            cursor.execute(
                "SELECT COUNT(*) AS total_count "
                "FROM attendance_logs "
                "WHERE student_id = %s AND session_date >= %s",
                (student_id, window_start.date()),
            )
            total_row = cursor.fetchone()
            total_attendances = total_row["total_count"] if total_row else 0

            if total_attendances == 0:
                cursor.close()
                conn.close()
                return []

            # Count attendances in the last 7 days
            cursor.execute(
                "SELECT COUNT(*) AS recent_count "
                "FROM attendance_logs "
                "WHERE student_id = %s AND session_date >= %s",
                (student_id, seven_days_ago.date()),
            )
            recent_row = cursor.fetchone()
            recent_7day_frequency = recent_row["recent_count"] if recent_row else 0

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(
                "Database error in attendance dropoff detector for student %s: %s",
                student_id,
                e,
            )
            return []

        # Compute average weekly frequency
        weeks_in_window = historical_window_days / 7.0
        avg_weekly_frequency = total_attendances / weeks_in_window

        # Avoid division by zero
        if avg_weekly_frequency == 0:
            return []

        # Compute dropoff ratio
        dropoff_ratio = recent_7day_frequency / avg_weekly_frequency

        # Compute score: 0 at 40%+, 1.0 at 0%
        score = max(0.0, 1.0 - (dropoff_ratio / 0.4))
        # Clamp score between 0.0 and 1.0
        score = min(1.0, max(0.0, score))

        # Detected when ratio < 0.4
        detected = dropoff_ratio < 0.4

        if not detected:
            return []

        # Generate description
        percentage_drop = round((1.0 - dropoff_ratio) * 100)
        description = (
            f"{event.get('student_name', 'Student')} has attended "
            f"{recent_7day_frequency} time(s) in the last 7 days, "
            f"a {percentage_drop}% drop from their average of "
            f"{avg_weekly_frequency:.1f} per week"
        )

        detected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        return [
            {
                "student_id": student_id,
                "student_name": event.get("student_name", ""),
                "pattern_type": self.PATTERN_TYPE,
                "score": score,
                "description": description,
                "detected_at": detected_at,
            }
        ]
