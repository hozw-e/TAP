"""Plain-language description generator for anomaly alerts.

Generates human-readable descriptions that always include the student's name
and a quantified reference to the detected pattern.
"""


def generate_description(pattern_type: str, student_name: str, **context) -> str:
    """Generate a plain-language description for an anomaly alert.

    Args:
        pattern_type: one of 'chronic_tardiness', 'attendance_dropoff',
                      'irregular_timing', 'early_departure'
        student_name: the student's display name
        **context: pattern-specific data:
            chronic_tardiness: tardy_count, total_records, window_days
            attendance_dropoff: recent_frequency, avg_frequency, drop_percentage
            irregular_timing: check_in_time, usual_time, deviation_hours, day_of_week, course
            early_departure: short_count, total_sessions, threshold_percentage
    """
    generators = {
        "chronic_tardiness": _describe_chronic_tardiness,
        "attendance_dropoff": _describe_attendance_dropoff,
        "irregular_timing": _describe_irregular_timing,
        "early_departure": _describe_early_departure,
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


def _describe_irregular_timing(student_name: str, **context) -> str:
    """Describe irregular timing with actual vs usual time."""
    check_in_time = context.get("check_in_time", "unknown")
    usual_time = context.get("usual_time", "unknown")
    deviation_hours = context.get("deviation_hours", 0)
    day_of_week = context.get("day_of_week", "")
    course = context.get("course", "")

    day_course = ""
    if day_of_week and course:
        day_course = f" for {day_of_week} {course}"
    elif course:
        day_course = f" for {course}"

    return (
        f"{student_name} checked in at {check_in_time}, "
        f"{deviation_hours:.1f} hours later than the usual "
        f"{usual_time}{day_course}"
    )


def _describe_early_departure(student_name: str, **context) -> str:
    """Describe early departure with session count."""
    short_count = context.get("short_count", 0)
    total_sessions = context.get("total_sessions", 0)
    threshold_percentage = context.get("threshold_percentage", 50)

    return (
        f"{student_name} left early in {short_count} of the last "
        f"{total_sessions} sessions (stayed less than "
        f"{threshold_percentage}% of scheduled time)"
    )
