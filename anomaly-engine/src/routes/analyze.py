"""POST /analyze and POST /analyze/batch endpoints for anomaly detection."""

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from src.config import load_config
from src.db.connection import get_connection
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


def _run_detectors_for_event(event, config):
    """Run all enabled detectors for a single event and return filtered alerts.

    Shared by both the single-event /analyze path and the batch path.
    Normalizes each detector's output so every alert has the fields the
    Alert model needs to persist (student_name, description, detected_at),
    since some detectors return a minimal dict.

    Args:
        event: dict with at least student_id, student_name, timestamp, course.
        config: loaded config dict with alert_threshold and enabled_patterns.

    Returns:
        list of alert dicts that meet or exceed the alert threshold.
    """
    alert_threshold = config.get("alert_threshold", 0.7)
    enabled_patterns = config.get("enabled_patterns", [])
    student_id = event["student_id"]

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
    filtered = [a for a in all_alerts if a.get("score", 0) >= alert_threshold]

    # Normalize so every alert can be persisted (some detectors return a
    # minimal dict without student_name/description/detected_at).
    now_iso = datetime.now().isoformat()
    for a in filtered:
        a.setdefault("student_id", student_id)
        a.setdefault("student_name", event.get("student_name", "Unknown"))
        a.setdefault("detected_at", now_iso)
        a.setdefault(
            "description",
            f"{a.get('pattern_type', 'anomaly')} detected for "
            f"{a.get('student_name', 'student')}",
        )

    return filtered


def _persist_alerts(alerts):
    """Persist a list of normalized alert dicts to the anomaly_alerts table."""
    persisted = 0
    for alert_data in alerts:
        try:
            Alert(
                student_id=alert_data["student_id"],
                student_name=alert_data["student_name"],
                pattern_type=alert_data["pattern_type"],
                score=alert_data["score"],
                description=alert_data["description"],
                detected_at=alert_data["detected_at"],
            ).persist_to_db()
            persisted += 1
        except Exception as e:
            logger.error("Failed to persist alert: %s", e)
    return persisted


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

    filtered_alerts = _run_detectors_for_event(event, config)
    _persist_alerts(filtered_alerts)

    # Update last analysis timestamp
    last_analysis_at = datetime.now().isoformat()

    return jsonify({"alerts": filtered_alerts}), 200


def _fetch_students_for_batch():
    """Fetch all non-archived students with the data detectors need.

    Returns a list of dicts: student_id, student_name, course, last_time_in.
    last_time_in (if any) seeds the synthetic event timestamp so detectors
    like irregular_timing evaluate the student's most recent attended session.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT s.student_id, s.student_name, s.student_course AS course, "
        "  ( SELECT MAX(TIMESTAMP(al.date, al.time_in)) "
        "    FROM attendance_logs al "
        "    WHERE al.student_id = s.student_id AND al.time_in IS NOT NULL "
        "  ) AS last_time_in "
        "FROM students s "
        "WHERE s.is_archived = 0 OR s.is_archived IS NULL"
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


def _already_alerted_today(student_id, pattern_type):
    """Return True if an alert for this student+pattern already exists today.

    Keeps the batch run idempotent: running it multiple times in one day
    (manually and then via the future daily cron) won't create duplicates.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM anomaly_alerts "
        "WHERE student_id = %s AND pattern_type = %s "
        "AND DATE(detected_at) = CURDATE() LIMIT 1",
        (student_id, pattern_type),
    )
    found = cursor.fetchone() is not None
    cursor.close()
    conn.close()
    return found


@analyze_bp.route("/analyze/batch", methods=["POST"])
def analyze_batch():
    """Run anomaly detection across all active students using existing data.

    This is the on-demand/backfill path. It analyzes attendance history
    already stored in the database rather than waiting for a live NFC
    check-in event. It is safe to call repeatedly (idempotent per day) and
    is the same endpoint a future daily cron job will call.

    Returns:
        JSON summary: students analyzed, alerts created, duplicates skipped.
    """
    global last_analysis_at

    try:
        config = load_config()
    except Exception as e:
        logger.exception("Batch analyze: failed to load config")
        return jsonify({"error": f"Failed to load config: {e}"}), 500

    try:
        students = _fetch_students_for_batch()
    except Exception as e:
        logger.exception("Batch analyze: failed to fetch students")
        return jsonify({"error": f"Failed to load students: {e}"}), 500

    students_analyzed = 0
    alerts_created = 0
    duplicates_skipped = 0

    for student in students:
        students_analyzed += 1

        # Seed the synthetic event with the student's most recent attended
        # session; fall back to now if they have no attended sessions yet.
        last_time_in = student.get("last_time_in")
        timestamp = (
            last_time_in.isoformat()
            if hasattr(last_time_in, "isoformat")
            else datetime.now().isoformat()
        )

        event = {
            "student_id": student["student_id"],
            "student_name": student.get("student_name", "Unknown"),
            "action": "check_in",
            "timestamp": timestamp,
            "course": student.get("course"),
            "attendance_flag": None,
        }

        try:
            alerts = _run_detectors_for_event(event, config)

            # Deduplicate against alerts already written today, then persist.
            fresh = []
            for alert in alerts:
                if _already_alerted_today(alert["student_id"], alert["pattern_type"]):
                    duplicates_skipped += 1
                else:
                    fresh.append(alert)

            alerts_created += _persist_alerts(fresh)
        except Exception as e:
            logger.exception(
                "Batch analyze: processing failed for student %s",
                student["student_id"],
            )
            continue

    last_analysis_at = datetime.now().isoformat()

    summary = {
        "students_analyzed": students_analyzed,
        "alerts_created": alerts_created,
        "duplicates_skipped": duplicates_skipped,
        "ran_at": last_analysis_at,
    }
    logger.info("Batch analyze complete: %s", summary)
    return jsonify(summary), 200
