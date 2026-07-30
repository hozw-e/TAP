"""Early departure anomaly detector.

Detects students who consistently leave sessions before the scheduled
end time by comparing actual session durations against scheduled durations.

Algorithm:
    For each session in the historical window:
        actual_duration = time_out - time_in (in minutes)
        scheduled_duration = schedule.end_time - schedule.start_time (in minutes)
        is_early = actual_duration < 0.5 * scheduled_duration
    short_session_count = count(is_early)
    score = min(1.0, short_session_count / 6.0)  # 3 sessions = 0.5, 6 = 1.0
    detected = short_session_count >= 3

Minimum 3 short sessions required for detection.
Sessions without a matching schedule or without time_out are skipped.
"""

import logging
from datetime import datetime, timedelta

from src.db.connection import get_connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)


class EarlyDepartureDetector(BaseDetector):
    """Detects early departure pattern in student attendance."""

    PATTERN_TYPE = "early_departure"
    MIN_SHORT_SESSIONS = 3

    def detect(self, student_id, event, config):
        """Analyze student's session durations vs scheduled durations.

        Queries attendance_logs for sessions with both time_in and time_out
        within the historical window, joins with course_schedules to get
        scheduled duration, and counts sessions where actual duration is
        less than 50% of the scheduled duration.

        Args:
            student_id: int - the student ID
            event: dict - the attendance event that triggered analysis
            config: dict - config with historical_window_days

        Returns:
            list of alert dicts if short_session_count >= 3, else empty list
        """
        historical_window_days = config.get("historical_window_days", 30)
        window_start = datetime.now() - timedelta(days=historical_window_days)

        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

            # Query sessions with both time_in and time_out, joined with
            # course_schedules to get the scheduled duration.
            # Join on course name and day of week matching.
            cursor.execute(
                "SELECT "
                "  TIMESTAMPDIFF(MINUTE, al.time_in, al.time_out) AS actual_minutes, "
                "  TIMESTAMPDIFF(MINUTE, cs.start_time, cs.end_time) AS scheduled_minutes "
                "FROM attendance_logs al "
                "INNER JOIN course_schedules cs "
                "  ON al.course = cs.course_name "
                "  AND DAYOFWEEK(al.session_date) = CASE cs.day_of_week "
                "    WHEN 'Sunday' THEN 1 "
                "    WHEN 'Monday' THEN 2 "
                "    WHEN 'Tuesday' THEN 3 "
                "    WHEN 'Wednesday' THEN 4 "
                "    WHEN 'Thursday' THEN 5 "
                "    WHEN 'Friday' THEN 6 "
                "    WHEN 'Saturday' THEN 7 "
                "  END "
                "WHERE al.student_id = %s "
                "  AND al.session_date >= %s "
                "  AND al.time_out IS NOT NULL",
                (student_id, window_start.strftime("%Y-%m-%d")),
            )
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(
                "EarlyDepartureDetector DB error for student %s: %s",
                student_id,
                e,
            )
            return []

        if not rows:
            return []

        # Count sessions where actual duration < 50% of scheduled duration
        short_session_count = 0
        for row in rows:
            actual_minutes = row["actual_minutes"]
            scheduled_minutes = row["scheduled_minutes"]

            # Skip rows where duration data is invalid
            if actual_minutes is None or scheduled_minutes is None:
                continue
            if scheduled_minutes <= 0:
                continue

            if actual_minutes < 0.5 * scheduled_minutes:
                short_session_count += 1

        # Not enough short sessions to flag
        if short_session_count < self.MIN_SHORT_SESSIONS:
            return []

        # Compute score: clamped between 0.0 and 1.0
        score = min(1.0, short_session_count / 6.0)
        score = max(0.0, score)

        student_name = event.get("student_name", "Unknown")
        detected_at = datetime.now().isoformat()

        return [
            {
                "student_id": student_id,
                "student_name": student_name,
                "pattern_type": self.PATTERN_TYPE,
                "score": round(score, 4),
                "description": (
                    f"{student_name} left early in {short_session_count} "
                    f"sessions in the last {historical_window_days} days "
                    f"(stayed less than 50% of scheduled time)"
                ),
                "detected_at": detected_at,
            }
        ]
