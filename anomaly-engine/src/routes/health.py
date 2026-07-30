"""GET /health endpoint for service health monitoring."""

import logging
import time

from flask import Blueprint, jsonify

from src.db.connection import get_connection

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__)

# Track service start time
_start_time = time.time()


@health_bp.route("/health", methods=["GET"])
def health():
    """Return service health status, uptime, and last analysis timestamp.

    Response JSON:
        status: "healthy" | "degraded"
        uptime_seconds: int
        last_analysis_at: str | None (ISO 8601)

    Status logic:
        - "healthy" if DB is reachable
        - "degraded" if DB is unreachable
    """
    from src.routes.analyze import get_last_analysis_at

    uptime_seconds = int(time.time() - _start_time)
    last_analysis = get_last_analysis_at()

    # Check DB connectivity
    status = "healthy"
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        logger.warning("Health check DB probe failed: %s", e)
        status = "degraded"

    return jsonify({
        "status": status,
        "uptime_seconds": uptime_seconds,
        "last_analysis_at": last_analysis,
    }), 200
