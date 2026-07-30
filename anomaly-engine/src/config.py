"""Configuration loading from database with hardcoded defaults fallback."""

import logging

from src.db.connection import get_connection

logger = logging.getLogger(__name__)

# Hardcoded defaults used when DB is unavailable
DEFAULTS = {
    "alert_threshold": 0.7,
    "historical_window_days": 30,
    "enabled_patterns": [
        "chronic_tardiness",
        "attendance_dropoff",
        "irregular_timing",
        "early_departure",
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
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT alert_threshold, historical_window_days, "
            "chronic_tardiness_enabled, attendance_dropoff_enabled, "
            "irregular_timing_enabled, early_departure_enabled "
            "FROM anomaly_config WHERE config_id = 1"
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if row is None:
            logger.warning("No config row found in anomaly_config, using defaults")
            return dict(DEFAULTS)

        enabled_patterns = []
        if row["chronic_tardiness_enabled"]:
            enabled_patterns.append("chronic_tardiness")
        if row["attendance_dropoff_enabled"]:
            enabled_patterns.append("attendance_dropoff")
        if row["irregular_timing_enabled"]:
            enabled_patterns.append("irregular_timing")
        if row["early_departure_enabled"]:
            enabled_patterns.append("early_departure")

        return {
            "alert_threshold": float(row["alert_threshold"]),
            "historical_window_days": int(row["historical_window_days"]),
            "enabled_patterns": enabled_patterns,
        }

    except Exception as e:
        logger.error("Failed to load config from DB: %s. Using defaults.", e)
        return dict(DEFAULTS)
