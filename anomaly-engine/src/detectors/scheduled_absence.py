"""Scheduled-absence anomaly detector.

Flags students who keep missing the sessions their course is actually
scheduled for. Unlike the other detectors, this one does not depend on an
"absent" row ever being written to ``attendance_logs``. A missed class in this
system leaves *no row at all*, so a detector that only counts existing rows is
blind to no-shows. This detector instead reconstructs the sessions that *should*
have happened from ``course_schedules`` (a weekly, day-of-week recurrence) and
compares them against the days the student actually checked in.

Algorithm
---------
1. Load the student's enrollment date (``students.created_at``), their course,
   and the course's weekly meeting days (``course_schedules.day_of_week``).
2. Enumerate every calendar date on which the course was scheduled to meet,
   from enrollment (after a one-week start-up grace) through today, bounded by
   the configured historical window.
3. For each scheduled date, check whether the student has an attended row
   (``time_in IS NOT NULL``) on that date. A date with no attended row is a
   missed scheduled session.
4. Compute two signals:
     - ``missed_ratio``        = missed / expected scheduled sessions
     - ``consecutive_missed``  = length of the current run of missed sessions
                                 ending at the most recent scheduled date.
5. Flag when ``consecutive_missed >= CONSECUTIVE_THRESHOLD`` (default 2) OR
   ``missed_ratio >= RATIO_THRESHOLD`` (default 0.5). The score is the stronger
   of the two normalized signals, so a long absence streak or a high overall
   miss rate both drive the score toward 1.0.

Courses with no schedule
-------------------------
If the student's course has no rows in ``course_schedules`` we cannot know when
they were supposed to attend, so a schedule-based verdict is impossible. The
caller (and a future schedule backfill) should address that; this detector
returns no alert rather than guessing.
"""

import logging
from datetime import date, datetime, timedelta

from src.db.connection import connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)

# Map the course_schedules.day_of_week enum to Python's weekday() index
# (Monday=0 .. Sunday=6) so we can walk the calendar and test membership.
_WEEKDAY_INDEX = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}


class ScheduledAbsenceDetector(BaseDetector):
    """Detects chronic/consecutive absence from scheduled course sessions."""

    PATTERN_TYPE = "scheduled_absence"

    # Weeks of grace after enrollment before the first session is expected.
    # Mirrors CourseDelayDetector so a brand-new student is never flagged on
    # day one for a session they couldn't yet have attended.
    START_GRACE_WEEKS = 1

    # Fire if the student has missed at least this many scheduled sessions in a
    # row (ending at the most recent scheduled date). "Consecutive" per the
    # requirement: two no-shows back to back is the trigger.
    CONSECUTIVE_THRESHOLD = 2

    # Fire if the student has missed at least this fraction of all the sessions
    # they were expected to attend in the window, even if not consecutive.
    RATIO_THRESHOLD = 0.5

    def detect(self, student_id, event, config):
        """Analyze scheduled sessions vs. actual attendance for this student.

        Args:
            student_id: int - the student ID.
            event: dict - triggering event; only student_name is read.
            config: dict - loaded config; historical_window_days bounds how far
                back scheduled sessions are enumerated.

        Returns:
            list with a single alert dict when the student is chronically or
            consecutively absent, otherwise an empty list.
        """
        historical_window_days = int(config.get("historical_window_days", 30))

        try:
            with connection() as conn:
                cursor = conn.cursor(dictionary=True)

                # Enrollment + course for the student.
                cursor.execute(
                    "SELECT student_name, student_course, created_at AS enrolled_at "
                    "FROM students WHERE student_id = %s",
                    (student_id,),
                )
                student = cursor.fetchone()

                if student is None:
                    cursor.close()
                    return []

                course = student.get("student_course")
                enrolled_at = student.get("enrolled_at")
                student_name = student.get("student_name") or event.get(
                    "student_name", "Unknown"
                )

                if not course or enrolled_at is None:
                    cursor.close()
                    return []

                # Weekly meeting days for the course.
                cursor.execute(
                    "SELECT day_of_week FROM course_schedules "
                    "WHERE course_name = %s",
                    (course,),
                )
                schedule_rows = cursor.fetchall()

                # No schedule => cannot infer expected sessions. Bail out; a
                # schedule backfill is the correct fix for these courses.
                if not schedule_rows:
                    cursor.close()
                    return []

                scheduled_weekdays = {
                    _WEEKDAY_INDEX[r["day_of_week"]]
                    for r in schedule_rows
                    if r.get("day_of_week") in _WEEKDAY_INDEX
                }
                if not scheduled_weekdays:
                    cursor.close()
                    return []

                # Days the student actually attended (checked in), bounded by
                # the window so one ancient visit can't mask a recent streak.
                window_start = date.today() - timedelta(
                    days=historical_window_days
                )
                cursor.execute(
                    "SELECT DISTINCT date FROM attendance_logs "
                    "WHERE student_id = %s AND time_in IS NOT NULL "
                    "AND date >= %s",
                    (student_id, window_start),
                )
                attended_rows = cursor.fetchall()
                cursor.close()

        except Exception as e:
            logger.error(
                "ScheduledAbsenceDetector DB error for student %s: %s",
                student_id,
                e,
            )
            return []

        attended_dates = {
            self._as_date(r["date"]) for r in attended_rows if r.get("date")
        }
        attended_dates.discard(None)

        enrolled_date = self._as_date(enrolled_at)
        if enrolled_date is None:
            return []

        # First date we start expecting attendance: enrollment + grace, but
        # never earlier than the historical window.
        today = date.today()
        grace_start = enrolled_date + timedelta(weeks=self.START_GRACE_WEEKS)
        window_start_date = today - timedelta(days=historical_window_days)
        start = max(grace_start, window_start_date)

        if start > today:
            # Still inside the grace period / window has no scheduled days yet.
            return []

        # Enumerate every scheduled session date in [start, today].
        expected_dates = []
        cursor_date = start
        while cursor_date <= today:
            if cursor_date.weekday() in scheduled_weekdays:
                expected_dates.append(cursor_date)
            cursor_date += timedelta(days=1)

        expected_count = len(expected_dates)
        if expected_count == 0:
            # No scheduled sessions have come due yet.
            return []

        # Classify each expected session as attended or missed, in order.
        missed_flags = [d not in attended_dates for d in expected_dates]
        missed_count = sum(missed_flags)

        if missed_count == 0:
            return []

        missed_ratio = missed_count / float(expected_count)

        # Longest run of consecutive misses ending at the most recent scheduled
        # session (the "are they currently absent?" signal).
        consecutive_missed = 0
        for flag in reversed(missed_flags):
            if flag:
                consecutive_missed += 1
            else:
                break

        hit_consecutive = consecutive_missed >= self.CONSECUTIVE_THRESHOLD
        hit_ratio = missed_ratio >= self.RATIO_THRESHOLD
        if not (hit_consecutive or hit_ratio):
            return []

        # Score: take the stronger of the two normalized signals.
        #  - ratio signal is simply the miss fraction (0..1).
        #  - streak signal saturates at 1.0 once the student has missed a full
        #    course's worth of consecutive sessions (4), so 2 missed ~= 0.5,
        #    3 ~= 0.75, 4+ ~= 1.0.
        streak_signal = min(1.0, consecutive_missed / 4.0)
        score = max(missed_ratio, streak_signal)
        score = round(min(1.0, max(0.0, score)), 4)

        attended_count = expected_count - missed_count
        description = (
            f"{student_name} is missing scheduled {course} sessions: attended "
            f"{attended_count} of {expected_count} scheduled session(s) in the "
            f"last {historical_window_days} days ({missed_count} missed, "
            f"{missed_ratio:.0%} miss rate), including "
            f"{consecutive_missed} in a row most recently."
        )

        return [
            {
                "student_id": student_id,
                "student_name": student_name,
                "pattern_type": self.PATTERN_TYPE,
                "score": score,
                "description": description,
                "detected_at": datetime.now().isoformat(),
            }
        ]

    @staticmethod
    def _as_date(value):
        """Normalize a DB date/datetime/string value into a date object."""
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            text = value.strip().replace("T", " ")
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.strptime(text[: len(fmt) + 2], fmt).date()
                except ValueError:
                    continue
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                return None
        return None
