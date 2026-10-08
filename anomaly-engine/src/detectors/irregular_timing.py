"""Irregular timing anomaly detector.

Detects when a student's check-in time deviates significantly from their
personal average for a given day of week, pooled across ALL of the student's
enrollments.

Design note (4-session courses):
    The academy caps each course at 4 sessions, then auto-archives the student.
    Segmenting history by course would leave at most 3 prior records per course,
    which is too thin for a meaningful baseline. Because attendance_logs does not
    store a per-record course, and because arrival-time habits are a personal
    behavioural trait rather than a course-specific one, this detector pools a
    student's entire attendance history (across every course they have enrolled
    in) and segments only by day of week. Students who re-enroll therefore build
    a usable baseline over time.

Algorithm:
    1. Get the day_of_week from the event timestamp
    2. Query attendance_logs for the student's past check-ins on the same weekday
       (all courses/enrollments pooled)
    3. Convert time_in to minutes from midnight
    4. Require at least 3 historical records (excluding current)
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

# Lowered from 4 to 3: with only 4 sessions per course, requiring 4 prior
# records meant the detector could never fire. 3 lets it evaluate the 4th session.
MINIMUM_RECORDS = 3


class IrregularTimingDetector(BaseDetector):
    """Detects irregular check-in timing patterns."""

    def detect(self, student_id, event, config):
        """Analyze check-in timing for irregularity.

        Args:
            student_id: The student's ID.
            event: Dict with 'timestamp' (ISO 8601). 'course' is accepted but no
                longer used for segmentation (history is pooled across courses).
            config: Dict with 'historical_window_days' (int).

        Returns:
            List of alert dicts. Empty if no anomaly or insufficient data.
        """
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

        # Query historical check-in times for the same student and day of week,
        # pooled across all of the student's enrollments (no course filter).
        historical_window_days = config.get("historical_window_days", 30)
        window_start = current_time - timedelta(days=historical_window_days)

        historical_minutes = self._query_historical_times(
            student_id, day_of_week, window_start, current_time
        )

        # Need at least MINIMUM_RECORDS historical records (excluding the current one)
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
            student_name = event.get("student_name", "Unknown")

            # Format minutes-from-midnight as HH:MM, clamped to a valid
            # 00:00..23:59 range so the description can never show a negative
            # or overflowed time even if the inputs are unexpected.
            def _fmt(total_minutes):
                m = max(0, min(1439, int(round(total_minutes))))
                return f"{m // 60:02d}:{m % 60:02d}"

            avg_time = _fmt(mean)
            cur_time = _fmt(current_minutes)
            return [
                {
                    "student_id": student_id,
                    "student_name": student_name,
                    "pattern_type": "irregular_timing",
                    "score": round(score, 4),
                    "description": (
                        f"{student_name} checked in at "
                        f"{cur_time}, which deviates sharply from "
                        f"their usual ~{avg_time} for this weekday "
                        f"(z-score {z_score:.1f})"
                    ),
                    "detected_at": datetime.now().isoformat(),
                    "detected": True,
                }
            ]

        return []

    def _query_historical_times(
        self, student_id, day_of_week, window_start, current_time
    ):
        """Query historical check-in times from attendance_logs.

        Pools the student's entire attendance history (all courses/enrollments)
        and filters only by day of week.

        Args:
            student_id: The student's ID.
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

            # History is pooled across all of the student's enrollments — no
            # course filter. Day-of-week is derived from the `date` column, and
            # time_in (a TIME value) is combined with `date` to build the full
            # datetime used for windowing.
            query = """
                SELECT al.date, al.time_in
                FROM attendance_logs al
                WHERE al.student_id = %s
                  AND DAYOFWEEK(al.date) = %s
                  AND al.time_in IS NOT NULL
                  AND TIMESTAMP(al.date, al.time_in) >= %s
                  AND TIMESTAMP(al.date, al.time_in) < %s
                ORDER BY al.date ASC, al.time_in ASC
            """

            cursor.execute(
                query,
                (
                    student_id,
                    mysql_day_of_week,
                    window_start,
                    current_time,
                ),
            )

            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            # Convert time_in to minutes from midnight. A MySQL TIME column is
            # returned by mysql-connector as a datetime.timedelta, but we also
            # defensively handle datetime, time, and string forms.
            minutes_list = []
            for row in rows:
                time_in = row["time_in"]
                if time_in is None:
                    continue

                minutes = None
                if isinstance(time_in, timedelta):
                    minutes = int(time_in.total_seconds() // 60)
                elif isinstance(time_in, datetime):
                    minutes = time_in.hour * 60 + time_in.minute
                elif hasattr(time_in, "hour") and hasattr(time_in, "minute"):
                    # datetime.time
                    minutes = time_in.hour * 60 + time_in.minute
                else:
                    # Handle case where time_in might be returned as a string
                    try:
                        parts = str(time_in).split(":")
                        minutes = int(parts[0]) * 60 + int(parts[1])
                    except (ValueError, IndexError, TypeError):
                        continue

                # Guard against malformed/out-of-range values. A valid wall-clock
                # time is 0..1439 minutes from midnight. MySQL TIME can store
                # negative or >24h values; such rows must not poison the mean.
                if minutes is None or minutes < 0 or minutes > 1439:
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
