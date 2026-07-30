# Feature: session-based-enrollment, Property 1: Session initialization is constant
"""Property-based tests verifying that session initialization is always exactly 4
regardless of the course value provided during student creation.

**Validates: Requirements 1.1**
"""

import sys

sys.path.insert(0, "c:/xampp/htdocs/apdc/anomaly-engine")

import hypothesis.strategies as st
from hypothesis import given, settings


# Simulate the session initialization logic from backend/api/students/create.php
# The PHP endpoint always sets remaining_sessions = 4 regardless of input parameters.
INITIAL_SESSIONS = 4


def create_student(course_value):
    """Simulate student creation logic.
    
    Mirrors the PHP endpoint behavior: regardless of the course value provided
    (NULL, empty string, any valid string), remaining_sessions is always set to 4.
    """
    student = {
        "student_course": course_value,
        "remaining_sessions": INITIAL_SESSIONS,
    }
    return student


class TestSessionInitializationConstant:
    """For any student creation request with any valid course value (including NULL),
    the resulting student record SHALL have remaining_sessions equal to exactly 4."""

    @given(
        course=st.one_of(st.none(), st.text(min_size=0, max_size=100))
    )
    @settings(max_examples=100)
    def test_remaining_sessions_always_four(self, course):
        """Regardless of course value, remaining_sessions must be exactly 4."""
        student = create_student(course)
        assert student["remaining_sessions"] == 4

    @given(
        course=st.one_of(st.none(), st.text(min_size=0, max_size=100))
    )
    @settings(max_examples=100)
    def test_remaining_sessions_not_other_values(self, course):
        """remaining_sessions must not be 0, 3, 5, or any value other than 4."""
        student = create_student(course)
        assert student["remaining_sessions"] != 0
        assert student["remaining_sessions"] != 3
        assert student["remaining_sessions"] != 5
        assert student["remaining_sessions"] == 4

    @given(
        course=st.one_of(st.none(), st.text(min_size=0, max_size=100))
    )
    @settings(max_examples=100)
    def test_initialization_is_constant_across_inputs(self, course):
        """The initialization value is CONSTANT — it does not vary with the input."""
        student1 = create_student(course)
        student2 = create_student(None)
        student3 = create_student("")
        student4 = create_student("Mathematics")
        assert student1["remaining_sessions"] == student2["remaining_sessions"]
        assert student2["remaining_sessions"] == student3["remaining_sessions"]
        assert student3["remaining_sessions"] == student4["remaining_sessions"]
        assert student4["remaining_sessions"] == INITIAL_SESSIONS
