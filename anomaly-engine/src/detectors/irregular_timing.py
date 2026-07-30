"""Irregular timing anomaly detector.

Detects when a student's check-in time deviates significantly from their
personal average for the same course and day of week.

Algorithm:
    1. Get the course and day_of_week from the event
    2. Query attendance_logs for past check-ins (same student, same course, same day of week)
    3. Convert time_in to minutes from midnight
    4. Require at least 4 historical records (excluding current)
    5. If stddev is 0, skip detection (no anomaly)
    6. Compute z-score for the current check-in time
    7. If z_score > 2.0, flag as anomaly

Score formula:
    score = min(1.0, z_score / 4.0)
    detected = z_score > 2.0
"""

import logging
from datetime import datetime, timedelta

import numpy as np

from src.db.connection import get_connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)

MINIMUM_RECORDS = 4


class IrregularTimingDetector(BaseDetector):
    """Detects irregular check-in timing patterns."""

    def detect(self, student_id, event, config):
        """Analyze check-in timing for irregularity.

        Args:
            student_id: The student's ID.
            event: Dict with 'timestamp' (ISO 8601) and 'course' (str|None).
            config: Dict with 'historical_window_days' (int).

        Returns:
            List of alert dicts. Empty if no anomaly or insufficient data.
        """
        course = event.get("course")
        if not course:
            # Cannot detect irregular timing without a course
            return []

        timestamp_str = event.get("timestamp")
        if not timestamp_str:
            return []

        try:
            current_time = datetime.fromisoformat(timestamp_str)
        except (ValueError, TypeError):
            logger.warning(
                "Invalid timestamp format for student %s: %s",
                student_id,
                timestamp_str,
            )
            return []

        # Get day of week (0=Monday, 6=Sunday)
        day_of_week = current_time.weekday()

        # Compute current check-in as minutes from midnight
        current_minutes = current_time.hour * 60 + current_time.minute

        # Query historical check-in times for same student, course, and day of week
        historical_window_days = config.get("historical_window_days", 30)
        window_start = current_time - timedelta(days=historical_window_days)

        historical_minutes = self._query_historical_times(
            student_id, course, day_of_week, window_start, current_time
        )

        # Need at least 4 historical records (excluding the current one)
        if len(historical_minutes) < MINIMUM_RECORDS:
            return []

        # Compute statistics using numpy
        times_array = np.array(historical_minutes, dtype=np.float64)
        mean = np.mean(times_array)
        stddev = np.std(times_array)

        # If stddev is 0, all times are the same - skip detection
        if stddev == 0:
            return []

        # Compute z-score
        deviation = abs(current_minutes - mean)
        z_score = deviation / stddev

        # Compute score, clamped between 0.0 and 1.0
        score = min(1.0, max(0.0, z_score / 4.0))

        # Determine if anomaly is detected
        detected = z_score > 2.0

        if detected:
            return [
                {
                    "student_id": student_id,
                    "pattern_type": "irregular_timing",
                    "score": round(score, 4),
                    "detected": True,
                }
            ]

        return []

    def _query_historical_times(
        self, student_id, course, day_of_week, window_start, current_time
    ):
        """Query historical check-in times from attendance_logs.

        Args:
            student_id: The student's ID.
            course: The course name to filter by.
            day_of_week: Integer day of week (0=Monday, 6=Sunday).
            window_start: Start of the historical window (datetime).
            current_time: Current check-in time (datetime), used to exclude current record.

        Returns:
            List of integers representing minutes from midnight for each historical check-in.
        """
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

            # Query attendance_logs for same student, same course, same day of week
            # DAYOFWEEK in MySQL returns 1=Sunday, 2=Monday, ..., 7=Saturday
            # Python weekday(): 0=Monday, 6=Sunday
            # Convert Python weekday to MySQL DAYOFWEEK: (python_weekday + 2) % 7 or map directly
            # MySQL: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
            # Python: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
            mysql_day_of_week = (day_of_week + 2) % 7
            if mysql_day_of_week == 0:
                mysql_day_of_week = 7

            query = """
                SELECT time_in
                FROM attendance_logs
                WHERE student_id = %s
                  AND course = %s
                  AND DAYOFWEEK(time_in) = %s
                  AND time_in >= %s
                  AND time_in < %s
                ORDER BY time_in ASC
            """

            cursor.execute(
                query,
                (
                    student_id,
                    course,
                    mysql_day_of_week,
                    window_start,
                    current_time,
                ),
            )

            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            # Convert time_in (DATETIME) to minutes from midnight
            minutes_list = []
            for row in rows:
                time_in = row["time_in"]
                if time_in is None:
                    continue
                if isinstance(time_in, datetime):
                    minutes = time_in.hour * 60 + time_in.minute
                else:
                    # Handle case where time_in might be returned as string
                    try:
                        dt = datetime.fromisoformat(str(time_in))
                        minutes = dt.hour * 60 + dt.minute
                    except (ValueError, TypeError):
                        continue
                minutes_list.append(minutes)

            return minutes_list

        except Exception as e:
            logger.error(
                "Failed to query historical times for student %s: %s",
                student_id,
                e,
            )
            return []
