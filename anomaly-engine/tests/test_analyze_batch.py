"""Tests for the POST /analyze/batch backfill endpoint."""

from unittest.mock import patch

import pytest

from src.app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


# A fixed config so detector enablement/threshold is deterministic in tests.
BATCH_CONFIG = {
    "alert_threshold": 0.7,
    "historical_window_days": 30,
    "enabled_patterns": [
        "chronic_tardiness",
        "attendance_dropoff",
        "irregular_timing",
        "early_departure",
    ],
}


def _student(student_id, name, course):
    # last_time_in None → batch falls back to datetime.now() timestamp
    return {
        "student_id": student_id,
        "student_name": name,
        "course": course,
        "last_time_in": None,
    }


@patch("src.routes.analyze.load_config", return_value=BATCH_CONFIG)
@patch("src.routes.analyze._fetch_students_for_batch")
@patch("src.routes.analyze._already_alerted_today", return_value=False)
@patch("src.routes.analyze._persist_alerts")
@patch("src.routes.analyze._run_detectors_for_event")
def test_batch_creates_alerts_for_each_student(
    mock_run, mock_persist, mock_dedup, mock_fetch, mock_cfg, client
):
    """Batch runs detectors per student and persists the resulting alerts."""
    mock_fetch.return_value = [
        _student(1, "Juan", "Arduino"),
        _student(2, "Maria", "Robotics"),
    ]
    # Each student yields exactly one alert
    mock_run.side_effect = [
        [{"student_id": 1, "pattern_type": "chronic_tardiness", "score": 0.9}],
        [{"student_id": 2, "pattern_type": "attendance_dropoff", "score": 0.8}],
    ]
    mock_persist.side_effect = lambda alerts: len(alerts)

    resp = client.post("/analyze/batch")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["students_analyzed"] == 2
    assert body["alerts_created"] == 2
    assert body["duplicates_skipped"] == 0
    # Detectors were run once per student
    assert mock_run.call_count == 2


@patch("src.routes.analyze.load_config", return_value=BATCH_CONFIG)
@patch("src.routes.analyze._fetch_students_for_batch")
@patch("src.routes.analyze._already_alerted_today", return_value=True)
@patch("src.routes.analyze._persist_alerts")
@patch("src.routes.analyze._run_detectors_for_event")
def test_batch_skips_duplicates_already_flagged_today(
    mock_run, mock_persist, mock_dedup, mock_fetch, mock_cfg, client
):
    """Alerts already present for today are skipped (idempotent re-runs)."""
    mock_fetch.return_value = [_student(1, "Juan", "Arduino")]
    mock_run.return_value = [
        {"student_id": 1, "pattern_type": "chronic_tardiness", "score": 0.9}
    ]
    mock_persist.side_effect = lambda alerts: len(alerts)

    resp = client.post("/analyze/batch")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["students_analyzed"] == 1
    assert body["alerts_created"] == 0
    assert body["duplicates_skipped"] == 1
    # Nothing fresh should have been persisted
    mock_persist.assert_called_once_with([])


@patch("src.routes.analyze.load_config", return_value=BATCH_CONFIG)
@patch("src.routes.analyze._fetch_students_for_batch")
@patch("src.routes.analyze._already_alerted_today", return_value=False)
@patch("src.routes.analyze._persist_alerts")
@patch("src.routes.analyze._run_detectors_for_event")
def test_batch_handles_no_alerts(
    mock_run, mock_persist, mock_dedup, mock_fetch, mock_cfg, client
):
    """A clean cohort returns zero alerts without error."""
    mock_fetch.return_value = [_student(1, "Juan", "Arduino")]
    mock_run.return_value = []
    mock_persist.side_effect = lambda alerts: len(alerts)

    resp = client.post("/analyze/batch")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["students_analyzed"] == 1
    assert body["alerts_created"] == 0


@patch("src.routes.analyze.load_config", return_value=BATCH_CONFIG)
@patch("src.routes.analyze._fetch_students_for_batch", side_effect=Exception("db down"))
def test_batch_returns_500_on_fetch_failure(mock_fetch, mock_cfg, client):
    """If the student fetch fails, the endpoint returns a 500 error."""
    resp = client.post("/analyze/batch")
    assert resp.status_code == 500
    assert "error" in resp.get_json()


def test_normalizer_fills_missing_alert_fields():
    """_run_detectors_for_event backfills name/description/detected_at.

    irregular_timing historically returned a minimal dict; the normalizer
    must make every alert persistable.
    """
    from src.routes import analyze as analyze_mod

    event = {
        "student_id": 7,
        "student_name": "Lance",
        "timestamp": "2026-01-15T10:00:00",
        "course": "Python Programming",
    }
    # Fake a detector that returns a minimal dict above threshold
    with patch.dict(
        analyze_mod.DETECTOR_MAP,
        {"irregular_timing": _MinimalDetector},
        clear=True,
    ):
        cfg = {"alert_threshold": 0.5, "enabled_patterns": ["irregular_timing"]}
        alerts = analyze_mod._run_detectors_for_event(event, cfg)

    assert len(alerts) == 1
    a = alerts[0]
    assert a["student_id"] == 7
    assert a["student_name"] == "Lance"
    assert "description" in a and a["description"]
    assert "detected_at" in a and a["detected_at"]


class _MinimalDetector:
    """Returns a minimal alert dict (no name/description/detected_at)."""

    def detect(self, student_id, event, config):
        return [{"student_id": student_id, "pattern_type": "irregular_timing", "score": 0.9}]
