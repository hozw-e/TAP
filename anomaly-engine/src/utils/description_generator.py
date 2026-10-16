"""Plain-language description generator for anomaly alerts.

Generates human-readable descriptions that always include the student's name
and a quantified reference to the detected pattern.
"""


def generate_description(pattern_type: str, student_name: str, **context) -> str:
    """Generate a plain-language description for an anomaly alert.

    Args:
        pattern_type: one of 'chronic_tardiness', 'attendance_dropoff',
                      'course_delay'
        student_name: the student's display name
        **context: pattern-specific data:
            chronic_tardiness: tardy_count, total_records, window_days
            attendance_dropoff: recent_frequency, avg_frequency, drop_percentage
            course_delay: course, sessions_used, max_sessions, expected_sessions, shortfall
    """
    generators = {
        "chronic_tardiness": _describe_chronic_tardiness,
        "attendance_dropoff": _describe_attendance_dropoff,
        "course_delay": _describe_course_delay,
    }

    generator = generators.get(pattern_type)
    if generator is None:
        return f"{student_name} has an unusual attendance pattern"

    return generator(student_name, **context)


def _describe_chronic_tardiness(student_name: str, **context) -> str:
    """Describe chronic tardiness with tardy count and total sessions."""
    tardy_count = context.get("tardy_count", 0)
    total_records = context.get("total_records", 0)
    window_days = context.get("window_days", 30)

    return (
        f"{student_name} has been late to {tardy_count} of "
        f"the last {total_records} sessions in the past {window_days} days"
    )


def _describe_attendance_dropoff(student_name: str, **context) -> str:
    """Describe attendance dropoff with percentage drop."""
    drop_percentage = context.get("drop_percentage", 0)
    days = context.get("days", 7)

    return (
        f"{student_name}'s attendance has dropped {drop_percentage:.0f}% "
        f"in the last {days} days compared to their average"
    )


def _describe_course_delay(student_name: str, **context) -> str:
    """Describe a course that is behind its expected pace."""
    course = context.get("course", "their course")
    sessions_used = context.get("sessions_used", 0)
    max_sessions = context.get("max_sessions", 4)
    expected_sessions = context.get("expected_sessions", 0)
    shortfall = context.get("shortfall", 0)

    return (
        f"{student_name}'s {course} course is running behind: used "
        f"{sessions_used} of {max_sessions} sessions, but should be at "
        f"{expected_sessions} by now ({shortfall} session(s) behind schedule)"
    )
