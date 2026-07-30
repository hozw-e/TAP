# Feature: realtime-anomaly-detection, Property 9: Irregular Timing Detection Correctness
"""Property-based tests for irregular timing detection.

**Validates: Requirements 3.4**

Tests verify that irregular timing detection occurs if and only if
the z-score exceeds 2.0, with a minimum of 4 historical records for
the same course and day of week.
"""

from unittest.mock import patch

import numpy as np
import pytest
from hypothesis import given, assume, settings
from hypothesis import strategies as st

from src.detectors.irregular_timing import IrregularTimingDetector


# Strategy: generate minutes from midnight (0-1439)
minutes_from_midnight = st.integers(min_value=0, max_value=1439)

# Strategy: list of historical times with at least 4 records
historical_times_min4 = st.lists(
    minutes_from_midnight, min_size=4, max_size=50
)

# Strategy: list of historical times with fewer than 4 records
historical_times_insufficient = st.lists(
    minutes_from_midnight, min_size=0, max_size=3
)


@pytest.fixture
def detector():
    return IrregularTimingDetector()


@pytest.fixture
def config():
    return {"historical_window_days": 30}


class TestIrregularTimingDetectionProperty:
    """Property 9: Irregular Timing Detection Correctness."""

    @given(
        historical_times=historical_times_min4,
        current_minutes=minutes_from_midnight,
    )
    @settings(max_examples=200)
    def test_detection_when_zscore_above_threshold(
        self, historical_times, current_minutes
    ):
        """Detection MUST occur when z_score > 2.0 with >= 4 records.

        For any set of >= 4 historical times and a current time where
        z_score > 2.0: detection MUST occur.
        """
        times_array = np.array(historical_times, dtype=np.float64)
        mean = np.mean(times_array)
        stddev = np.std(times_array)

        # Skip cases where stddev is 0 (tested separately)
        assume(stddev > 0)

        z_score = abs(current_minutes - mean) / stddev
        assume(z_score > 2.0)

        # Convert current_minutes to a timestamp string
        hours = current_minutes // 60
        mins = current_minutes % 60
        timestamp = f"2024-01-15T{hours:02d}:{mins:02d}:00"

        detector = IrregularTimingDetector()
        event = {"timestamp": timestamp, "course": "TestCourse"}
        config = {"historical_window_days": 30}

        with patch.object(
            IrregularTimingDetector,
            "_query_historical_times",
            return_value=historical_times,
        ):
            result = detector.detect(1, event, config)

        assert len(result) == 1, (
            f"Expected detection with z_score={z_score:.4f} > 2.0, "
            f"but got no detection. historical={historical_times}, "
            f"current={current_minutes}"
        )
        assert result[0]["pattern_type"] == "irregular_timing"
        assert result[0]["detected"] is True

    @given(
        historical_times=historical_times_min4,
        current_minutes=minutes_from_midnight,
    )
    @settings(max_examples=200)
    def test_no_detection_when_zscore_at_or_below_threshold(
        self, historical_times, current_minutes
    ):
        """Detection MUST NOT occur when z_score <= 2.0 with >= 4 records.

        For any set of >= 4 historical times and a current time where
        z_score <= 2.0: detection MUST NOT occur.
        """
        times_array = np.array(historical_times, dtype=np.float64)
        mean = np.mean(times_array)
        stddev = np.std(times_array)

        # Skip cases where stddev is 0 (tested separately)
        assume(stddev > 0)

        z_score = abs(current_minutes - mean) / stddev
        assume(z_score <= 2.0)

        # Convert current_minutes to a timestamp string
        hours = current_minutes // 60
        mins = current_minutes % 60
        timestamp = f"2024-01-15T{hours:02d}:{mins:02d}:00"

        detector = IrregularTimingDetector()
        event = {"timestamp": timestamp, "course": "TestCourse"}
        config = {"historical_window_days": 30}

        with patch.object(
            IrregularTimingDetector,
            "_query_historical_times",
            return_value=historical_times,
        ):
            result = detector.detect(1, event, config)

        assert result == [], (
            f"Expected no detection with z_score={z_score:.4f} <= 2.0, "
            f"but got detection. historical={historical_times}, "
            f"current={current_minutes}"
        )

    @given(
        historical_times=historical_times_insufficient,
        current_minutes=minutes_from_midnight,
    )
    @settings(max_examples=200)
    def test_no_detection_with_insufficient_records(
        self, historical_times, current_minutes
    ):
        """Detection MUST NOT occur with fewer than 4 historical records.

        For fewer than 4 historical records: detection MUST NOT occur
        regardless of the current check-in time.
        """
        # Convert current_minutes to a timestamp string
        hours = current_minutes // 60
        mins = current_minutes % 60
        timestamp = f"2024-01-15T{hours:02d}:{mins:02d}:00"

        detector = IrregularTimingDetector()
        event = {"timestamp": timestamp, "course": "TestCourse"}
        config = {"historical_window_days": 30}

        with patch.object(
            IrregularTimingDetector,
            "_query_historical_times",
            return_value=historical_times,
        ):
            result = detector.detect(1, event, config)

        assert result == [], (
            f"Expected no detection with only {len(historical_times)} records "
            f"(< 4 minimum), but got detection."
        )

    @given(
        identical_time=minutes_from_midnight,
        count=st.integers(min_value=4, max_value=20),
        current_minutes=minutes_from_midnight,
    )
    @settings(max_examples=200)
    def test_no_detection_when_stddev_zero(
        self, identical_time, count, current_minutes
    ):
        """Detection MUST NOT occur when all historical times are identical (stddev=0).

        When all historical times are the same, stddev is 0 and the detector
        should skip detection regardless of the current check-in time.
        """
        historical_times = [identical_time] * count

        # Convert current_minutes to a timestamp string
        hours = current_minutes // 60
        mins = current_minutes % 60
        timestamp = f"2024-01-15T{hours:02d}:{mins:02d}:00"

        detector = IrregularTimingDetector()
        event = {"timestamp": timestamp, "course": "TestCourse"}
        config = {"historical_window_days": 30}

        with patch.object(
            IrregularTimingDetector,
            "_query_historical_times",
            return_value=historical_times,
        ):
            result = detector.detect(1, event, config)

        assert result == [], (
            f"Expected no detection when stddev=0 (all times={identical_time}), "
            f"but got detection."
        )

    @given(
        historical_times=historical_times_min4,
        current_minutes=minutes_from_midnight,
    )
    @settings(max_examples=200)
    def test_score_always_in_valid_range(
        self, historical_times, current_minutes
    ):
        """Score is always in [0.0, 1.0].

        For any valid detection result, the score must be bounded
        between 0.0 and 1.0 inclusive.
        """
        times_array = np.array(historical_times, dtype=np.float64)
        stddev = np.std(times_array)
        assume(stddev > 0)

        # Convert current_minutes to a timestamp string
        hours = current_minutes // 60
        mins = current_minutes % 60
        timestamp = f"2024-01-15T{hours:02d}:{mins:02d}:00"

        detector = IrregularTimingDetector()
        event = {"timestamp": timestamp, "course": "TestCourse"}
        config = {"historical_window_days": 30}

        with patch.object(
            IrregularTimingDetector,
            "_query_historical_times",
            return_value=historical_times,
        ):
            result = detector.detect(1, event, config)

        for alert in result:
            assert 0.0 <= alert["score"] <= 1.0, (
                f"Score {alert['score']} outside [0.0, 1.0] range. "
                f"historical={historical_times}, current={current_minutes}"
            )
