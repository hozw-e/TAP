"""Course delay anomaly detector.

Detects students whose course is running behind its expected completion
schedule: they enrolled weeks ago but are not using up their course sessions
at the pace their weekly schedule implies. The academy caps each course at
``MAX_SESSIONS`` (4) sessions, tracked by ``students.remaining_sessions``
(default 4, decremented on each attended session). ``course_schedules`` says
how many times per week a course meets, and ``students.created_at`` is the
enrollment timestamp.

User story that motivates this detector:
    A student enrols in the first week of June and starts attending the next
    week. Their course meets once a week (e.g. every Wednesday) and caps at 4
    sessions, so by the first week of July they should have used up all 4.
    Instead they have only used 2. Those two unused weeks are the anomaly: the
    course is delayed.

Algorithm:
    sessions_used     = MAX_SESSIONS - remaining_sessions
    weeks_available   = floor((today - enrolled_date) / 7) - START_GRACE_WEEKS
    weekly_meetings   = number of course_schedules rows for the student's course
    expected_sessions = min(MAX_SESSIONS, weeks_available * weekly_meetings)
    shortfall         = expected_sessions - sessions_used
    detected          = shortfall >= 1  (course is behind by at least a session)

    score = min(1.0, shortfall / MAX_SESSIONS)

The student is skipped (no anomaly) when:
    - they have already completed the course (remaining_sessions == 0), or
    - not enough calendar time has passed to expect any session yet, or
    - the course has no weekly schedule to measure a pace against, or
    - the enrollment date is missing.

Unlike attendance_dropoff (which compares a student's recent attendance rate
against their own historical rate), this detector compares *elapsed calendar
time since enrolment* against *sessions actually consumed*. A student can look
fine to attendance_dropoff (no sudden drop) while their course silently falls
weeks behind schedule -- which is exactly the gap this fills.
"""

import logging
from datetime import date, datetime

from src.db.connection import connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)


class CourseDelayDetector(BaseDetector):
    """Detects courses that are running behind their expected pace."""

    PATTERN_TYPE = "course_delay"

    # Course session cap. Mirrors the DEFAULT 4 on students.remaining_sessions.
    MAX_SESSIONS = 4

    # Weeks of grace after enrollment before we expect the first session.
    # Covers the user story's "enrolls one week, starts the next week" gap so a
    # brand-new student is never flagged on day one.
    START_GRACE_WEEKS = 1

    def detect(self, student_id, event, config):
        """Analyze whether the student's course is behind its expected pace.

        Args:
            student_id: int - the student ID.
            event: dict - the triggering (possibly synthetic) event. Only
                student_name is read from it; everything else is queried fresh.
            config: dict - loaded config (unused here beyond the shared
                threshold applied by the caller, but accepted for contract
                compatibility).

        Returns:
            list with a single alert dict if the course is delayed, otherwise
            an empty list.
        """
        try:
            with connection() as conn:
                cursor = conn.cursor(dictionary=True)

                # Pull enrollment date, remaining sessions, and the number of
                # weekly meetings for the student's course in one round trip.
                cursor.execute(
                    "SELECT "
                    "  s.student_name, "
                    "  s.student_course, "
                    "  s.created_at AS enrolled_at, "
                    "  s.remaining_sessions, "
                    "  ( SELECT COUNT(*) FROM course_schedules cs "
                    "    WHERE cs.course_name = s.student_course "
                    "  ) AS weekly_meetings "
                    "FROM students s "
                    "WHERE s.student_id = %s",
                    (student_id,),
                )
                row = cursor.fetchone()
                cursor.close()

        except Exception as e:
            logger.error(
                "CourseDelayDetector DB error for student %s: %s",
                student_id,
                e,
            )
            return []

        if row is None:
            return []

        enrolled_at = row.get("enrolled_at")
        remaining_sessions = row.get("remaining_sessions")
        weekly_meetings = int(row.get("weekly_meetings") or 0)
        student_name = row.get("student_name") or event.get(
            "student_name", "Unknown"
        )

        # Can't measure a pace without a schedule or an enrollment date.
        if enrolled_at is None or weekly_meetings <= 0:
            return []

        if remaining_sessions is None:
            return []
        remaining_sessions = int(remaining_sessions)

        # Already finished the course: nothing is delayed.
        if remaining_sessions <= 0:
            return []

        sessions_used = self.MAX_SESSIONS - remaining_sessions
        if sessions_used < 0:
            sessions_used = 0

        enrolled_date = self._as_date(enrolled_at)
        if enrolled_date is None:
            return []

        today = date.today()
        days_elapsed = (today - enrolled_date).days
        if days_elapsed < 0:
            return []

        # Whole weeks the student has had to attend, minus the start-up grace.
        weeks_available = (days_elapsed // 7) - self.START_GRACE_WEEKS
        if weeks_available < 1:
            # Too early to expect any session yet.
            return []

        # Expected sessions, capped at the course total.
        expected_sessions = min(
            self.MAX_SESSIONS, weeks_available * weekly_meetings
        )

        shortfall = expected_sessions - sessions_used
        if shortfall < 1:
            return []

        score = min(1.0, shortfall / float(self.MAX_SESSIONS))

        course = row.get("student_course") or "their course"
        weeks_enrolled = days_elapsed // 7
        description = (
            f"{student_name}'s {course} course is running behind: enrolled about "
            f"{weeks_enrolled} week(s) ago but has only used {sessions_used} of "
            f"{self.MAX_SESSIONS} sessions ({remaining_sessions} unused). At the "
            f"scheduled pace they should be at {expected_sessions} by now -- "
            f"{shortfall} session(s) behind schedule."
        )

        return [
            {
                "student_id": student_id,
                "student_name": student_name,
                "pattern_type": self.PATTERN_TYPE,
                "score": round(score, 4),
                "description": description,
                "detected_at": datetime.now().isoformat(),
            }
        ]

    @staticmethod
    def _as_date(value):
        """Normalize a DB datetime/date/string value into a date object."""
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            # Handle both 'YYYY-MM-DD' and full ISO/space-separated datetimes.
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
