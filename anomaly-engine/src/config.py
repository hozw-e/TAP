"""Configuration loading from database with hardcoded defaults fallback."""

import logging

from src.db.connection import connection

logger = logging.getLogger(__name__)

# Hardcoded defaults used when DB is unavailable
DEFAULTS = {
    "alert_threshold": 0.7,
    "historical_window_days": 30,
    "enabled_patterns": [
        "chronic_tardiness",
        "attendance_dropoff",
        "course_delay",
        "ml_behavioral",
        "scheduled_absence",
    ],
}


def load_config():
    """Load anomaly detection configuration from the anomaly_config table.

    Falls back to hardcoded defaults if the database is unreachable or the
    config row doesn't exist.

    Returns:
        dict with keys: alert_threshold, historical_window_days, enabled_patterns
    """
    try:
        with connection() as conn:
            cursor = conn.cursor(dictionary=True)
            # Select all columns so this keeps working whether or not the
            # course_delay_enabled column (migration 011) has been applied
            # yet; the flag is read defensively below.
            cursor.execute(
                "SELECT * FROM anomaly_config WHERE config_id = 1"
            )
            row = cursor.fetchone()
            cursor.close()

        if row is None:
            logger.warning("No config row found in anomaly_config, using defaults")
            return dict(DEFAULTS)

        enabled_patterns = []
        if row["chronic_tardiness_enabled"]:
            enabled_patterns.append("chronic_tardiness")
        if row["attendance_dropoff_enabled"]:
            enabled_patterns.append("attendance_dropoff")
        # Default to enabled when the column doesn't exist yet (pre-migration).
        if row.get("course_delay_enabled", True):
            enabled_patterns.append("course_delay")
        # Default to enabled when the column doesn't exist yet (pre-migration).
        if row.get("ml_behavioral_enabled", True):
            enabled_patterns.append("ml_behavioral")
        # Default to enabled when the column doesn't exist yet (pre-migration).
        if row.get("scheduled_absence_enabled", True):
            enabled_patterns.append("scheduled_absence")

        return {
            "alert_threshold": float(row["alert_threshold"]),
            "historical_window_days": int(row["historical_window_days"]),
            "enabled_patterns": enabled_patterns,
        }

    except Exception as e:
        logger.error("Failed to load config from DB: %s. Using defaults.", e)
        return dict(DEFAULTS)
