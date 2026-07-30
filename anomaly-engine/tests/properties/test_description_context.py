# Feature: realtime-anomaly-detection, Property 13: Alert Description Contains Context
"""Property-based tests for alert description containing context.

**Validates: Requirements 4.5**

Properties verified:
1. For any student_name and any pattern_type with valid context,
   the generated description MUST contain the student_name.
2. The generated description MUST contain a number (quantified reference).
"""

import re
import sys

from hypothesis import given, settings, strategies as st, assume

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

from src.utils.description_generator import generate_description


# --- Strategies ---

# Student names with letters, numbers, and spaces (non-empty)
student_name_strategy = st.text(
    min_size=1,
    max_size=50,
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs")),
).filter(lambda s: s.strip() != "")

# Pattern types
pattern_types = st.sampled_from([
    "chronic_tardiness",
    "attendance_dropoff",
    "irregular_timing",
    "early_departure",
])


# --- Context generators per pattern type ---

def chronic_tardiness_context():
    """Generate context kwargs for chronic_tardiness descriptions."""
    return st.fixed_dictionaries({
        "tardy_count": st.integers(min_value=1, max_value=100),
        "total_records": st.integers(min_value=5, max_value=200),
        "window_days": st.integers(min_value=7, max_value=90),
    })


def attendance_dropoff_context():
    """Generate context kwargs for attendance_dropoff descriptions."""
    return st.fixed_dictionaries({
        "drop_percentage": st.floats(min_value=1.0, max_value=100.0),
        "days": st.integers(min_value=1, max_value=90),
    })


def irregular_timing_context():
    """Generate context kwargs for irregular_timing descriptions."""
    return st.fixed_dictionaries({
        "check_in_time": st.from_regex(r"[0-9]{1,2}:[0-9]{2}", fullmatch=True),
        "usual_time": st.from_regex(r"[0-9]{1,2}:[0-9]{2}", fullmatch=True),
        "deviation_hours": st.floats(min_value=0.1, max_value=12.0),
        "day_of_week": st.sampled_from(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
        "course": st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("L",))),
    })


def early_departure_context():
    """Generate context kwargs for early_departure descriptions."""
    return st.fixed_dictionaries({
        "short_count": st.integers(min_value=1, max_value=50),
        "total_sessions": st.integers(min_value=3, max_value=200),
        "threshold_percentage": st.integers(min_value=10, max_value=90),
    })


# --- Property tests ---


@given(
    student_name=student_name_strategy,
    context=chronic_tardiness_context(),
)
@settings(max_examples=100)
def test_chronic_tardiness_description_contains_name_and_number(student_name, context):
    """Chronic tardiness description MUST contain student name and a number."""
    description = generate_description("chronic_tardiness", student_name, **context)

    assert student_name in description, (
        f"Description must contain student name '{student_name}', "
        f"got: '{description}'"
    )
    assert re.search(r"\d+", description) is not None, (
        f"Description must contain a number (quantified reference), "
        f"got: '{description}'"
    )


@given(
    student_name=student_name_strategy,
    context=attendance_dropoff_context(),
)
@settings(max_examples=100)
def test_attendance_dropoff_description_contains_name_and_number(student_name, context):
    """Attendance dropoff description MUST contain student name and a number."""
    description = generate_description("attendance_dropoff", student_name, **context)

    assert student_name in description, (
        f"Description must contain student name '{student_name}', "
        f"got: '{description}'"
    )
    assert re.search(r"\d+", description) is not None, (
        f"Description must contain a number (quantified reference), "
        f"got: '{description}'"
    )


@given(
    student_name=student_name_strategy,
    context=irregular_timing_context(),
)
@settings(max_examples=100)
def test_irregular_timing_description_contains_name_and_number(student_name, context):
    """Irregular timing description MUST contain student name and a number."""
    description = generate_description("irregular_timing", student_name, **context)

    assert student_name in description, (
        f"Description must contain student name '{student_name}', "
        f"got: '{description}'"
    )
    assert re.search(r"\d+", description) is not None, (
        f"Description must contain a number (quantified reference), "
        f"got: '{description}'"
    )


@given(
    student_name=student_name_strategy,
    context=early_departure_context(),
)
@settings(max_examples=100)
def test_early_departure_description_contains_name_and_number(student_name, context):
    """Early departure description MUST contain student name and a number."""
    description = generate_description("early_departure", student_name, **context)

    assert student_name in description, (
        f"Description must contain student name '{student_name}', "
        f"got: '{description}'"
    )
    assert re.search(r"\d+", description) is not None, (
        f"Description must contain a number (quantified reference), "
        f"got: '{description}'"
    )
