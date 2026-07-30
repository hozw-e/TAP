"""POST /analyze endpoint for anomaly detection analysis."""

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from src.config import load_config
from src.detectors.attendance_dropoff import AttendanceDropoffDetector
from src.detectors.chronic_tardiness import ChronicTardinessDetector
from src.detectors.early_departure import EarlyDepartureDetector
from src.detectors.irregular_timing import IrregularTimingDetector
from src.models.alert import Alert

logger = logging.getLogger(__name__)

analyze_bp = Blueprint("analyze", __name__)

# Track last successful analysis timestamp for health endpoint
last_analysis_at = None

# Map pattern names to detector classes
DETECTOR_MAP = {
    "chronic_tardiness": ChronicTardinessDetector,
    "attendance_dropoff": AttendanceDropoffDetector,
    "irregular_timing": IrregularTimingDetector,
    "early_departure": EarlyDepartureDetector,
}


def get_last_analysis_at():
    """Return the ISO timestamp of the last successful analysis."""
    return last_analysis_at


@analyze_bp.route("/analyze", methods=["POST"])
def analyze():
    """Analyze an attendance event for anomaly patterns.

    Validates input, runs all enabled detectors, filters by threshold,
    persists alerts, and returns the alerts array.

    Request JSON:
        student_id: int (required)
        student_name: str
        action: "check_in" (required)
        timestamp: str (ISO 8601)
        course: str | None
        attendance_flag: str | None

    Returns:
        JSON with "alerts" array of alert dicts.
    """
    global last_analysis_at

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Validate required fields
    student_id = data.get("student_id")
    if student_id is None:
        return jsonify({"error": "student_id is required"}), 400

    try:
        student_id = int(student_id)
    except (TypeError, ValueError):
        return jsonify({"error": "student_id must be an integer"}), 400

    action = data.get("action")
    if action != "check_in":
        return jsonify({"error": "action must be 'check_in'"}), 400

    # Build event dict for detectors
    event = {
        "student_id": student_id,
        "student_name": data.get("student_name", "Unknown"),
        "action": action,
        "timestamp": data.get("timestamp", datetime.now().isoformat()),
        "course": data.get("course"),
        "attendance_flag": data.get("attendance_flag"),
    }

    # Load configuration from DB (or defaults)
    config = load_config()
    alert_threshold = config.get("alert_threshold", 0.7)
    enabled_patterns = config.get("enabled_patterns", [])

    # Run all enabled detectors
    all_alerts = []
    for pattern_name in enabled_patterns:
        detector_class = DETECTOR_MAP.get(pattern_name)
        if detector_class is None:
            continue

        try:
            detector = detector_class()
            results = detector.detect(student_id, event, config)
            if results:
                all_alerts.extend(results)
        except Exception as e:
            logger.error(
                "Detector %s failed for student %s: %s",
                pattern_name,
                student_id,
                e,
            )

    # Filter by threshold
    filtered_alerts = [a for a in all_alerts if a.get("score", 0) >= alert_threshold]

    # Persist filtered alerts to DB
    for alert_data in filtered_alerts:
        try:
            alert = Alert(
                student_id=alert_data["student_id"],
                student_name=alert_data["student_name"],
                pattern_type=alert_data["pattern_type"],
                score=alert_data["score"],
                description=alert_data["description"],
                detected_at=alert_data["detected_at"],
            )
            alert.persist_to_db()
        except Exception as e:
            logger.error("Failed to persist alert: %s", e)

    # Update last analysis timestamp
    last_analysis_at = datetime.now().isoformat()

    return jsonify({"alerts": filtered_alerts}), 200
