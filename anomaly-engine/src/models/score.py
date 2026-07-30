"""Score computation utilities for anomaly detection.

Provides clamping and ratio-based score calculations ensuring
all scores remain within the valid [0.0, 1.0] range.
"""


def clamp_score(score: float) -> float:
    """Clamp score to [0.0, 1.0] range.

    Args:
        score: Raw computed score value.

    Returns:
        Score clamped between 0.0 and 1.0 inclusive.
    """
    return max(0.0, min(1.0, score))


def compute_ratio_score(numerator: int, denominator: int) -> float:
    """Compute a score as a simple ratio, clamped to [0.0, 1.0].

    Args:
        numerator: The count of interest (e.g., tardy sessions).
        denominator: The total count (e.g., total sessions).

    Returns:
        The ratio clamped to [0.0, 1.0]. Returns 0.0 if denominator is 0.
    """
    if denominator == 0:
        return 0.0
    return clamp_score(numerator / denominator)
