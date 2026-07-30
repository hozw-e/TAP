"""Abstract base class for anomaly detectors."""

from abc import ABC, abstractmethod


class BaseDetector(ABC):
    """Abstract base class that all pattern detectors extend.

    Each detector analyzes a student's attendance data for a specific
    anomaly pattern and returns a list of alert dictionaries when
    the pattern is detected.
    """

    @abstractmethod
    def detect(self, student_id, event, config):
        """Analyze a student's attendance data for anomalies.

        Args:
            student_id: int - the student ID
            event: dict - the attendance event that triggered analysis.
                Contains: student_id, student_name, action, timestamp,
                course, attendance_flag
            config: dict - loaded config with alert_threshold,
                historical_window_days, enabled_patterns

        Returns:
            list of alert dicts, each with:
                student_id, student_name, pattern_type, score,
                description, detected_at
        """
        raise NotImplementedError
