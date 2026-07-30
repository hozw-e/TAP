"""GET/PUT /config endpoint for anomaly detection configuration."""

import logging

from flask import Blueprint, jsonify, request

from src.config import load_config
from src.db.connection import get_connection

logger = logging.getLogger(__name__)

config_bp = Blueprint("config", __name__)

# Valid pattern names
VALID_PATTERNS = [
    "chronic_tardiness",
    "attendance_dropoff",
    "irregular_timing",
    "early_departure",
]


@config_bp.route("/config", methods=["GET"])
def get_config():
    """Read current anomaly detection configuration.

    Response JSON:
        alert_threshold: float
        historical_window_days: int
        enabled_patterns: list of str
    """
    config = load_config()
    return jsonify(config), 200


@config_bp.route("/config", methods=["PUT"])
def put_config():
    """Update anomaly detection configuration.

    Request JSON:
        alert_threshold: float (0.5 - 1.0)
        historical_window_days: int (7 - 90)
        enabled_patterns: list of str

    Returns updated config on success, or error details on validation failure.
    """
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Validate alert_threshold
    alert_threshold = data.get("alert_threshold")
    if alert_threshold is not None:
        try:
            alert_threshold = float(alert_threshold)
        except (TypeError, ValueError):
            return jsonify({"error": "alert_threshold must be a number"}), 400
        if alert_threshold < 0.5 or alert_threshold > 1.0:
            return jsonify({
                "error": "alert_threshold must be between 0.5 and 1.0"
            }), 400

    # Validate historical_window_days
    historical_window_days = data.get("historical_window_days")
    if historical_window_days is not None:
        try:
            historical_window_days = int(historical_window_days)
        except (TypeError, ValueError):
            return jsonify({
                "error": "historical_window_days must be an integer"
            }), 400
        if historical_window_days < 7 or historical_window_days > 90:
            return jsonify({
                "error": "historical_window_days must be between 7 and 90"
            }), 400

    # Validate enabled_patterns
    enabled_patterns = data.get("enabled_patterns")
    if enabled_patterns is not None:
        if not isinstance(enabled_patterns, list):
            return jsonify({"error": "enabled_patterns must be a list"}), 400
        for pattern in enabled_patterns:
            if pattern not in VALID_PATTERNS:
                return jsonify({
                    "error": f"Invalid pattern: '{pattern}'. "
                             f"Valid patterns: {VALID_PATTERNS}"
                }), 400

    # Update the database
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Build the SET clause dynamically based on provided fields
        set_parts = []
        params = []

        if alert_threshold is not None:
            set_parts.append("alert_threshold = %s")
            params.append(alert_threshold)

        if historical_window_days is not None:
            set_parts.append("historical_window_days = %s")
            params.append(historical_window_days)

        if enabled_patterns is not None:
            # Update boolean columns based on which patterns are enabled
            set_parts.append("chronic_tardiness_enabled = %s")
            params.append("chronic_tardiness" in enabled_patterns)

            set_parts.append("attendance_dropoff_enabled = %s")
            params.append("attendance_dropoff" in enabled_patterns)

            set_parts.append("irregular_timing_enabled = %s")
            params.append("irregular_timing" in enabled_patterns)

            set_parts.append("early_departure_enabled = %s")
            params.append("early_departure" in enabled_patterns)

        if not set_parts:
            return jsonify({"error": "No valid fields provided to update"}), 400

        query = f"UPDATE anomaly_config SET {', '.join(set_parts)} WHERE config_id = 1"
        cursor.execute(query, params)
        conn.commit()
        cursor.close()
        conn.close()

    except Exception as e:
        logger.error("Failed to update config in DB: %s", e)
        return jsonify({"error": "Failed to save configuration"}), 500

    # Return the updated config
    updated_config = load_config()
    return jsonify(updated_config), 200
