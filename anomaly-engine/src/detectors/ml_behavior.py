"""Machine-learning behavioral anomaly detector (unsupervised).

Unlike the rule-based detectors (chronic_tardiness, attendance_dropoff,
course_delay) which fire on hand-tuned thresholds over a single metric, this
detector learns a *multivariate* model of normal student behavior from the
whole cohort and flags students whose combined behavioral profile is a
statistical outlier.

Algorithm
---------
1. Feature engineering: for every active student, build a fixed-length numeric
   feature vector that summarizes their attendance behavior over the historical
   window (see ``FEATURE_NAMES``).
2. Model: fit an **Isolation Forest** (Liu, Ting & Zhou, 2008) on the cohort's
   feature matrix. Isolation Forest is an unsupervised ensemble that isolates
   observations by randomly partitioning the feature space; anomalies require
   fewer random splits to isolate and therefore get a shorter expected path
   length. It needs no labels, which fits this problem (we have no ground-truth
   "anomalous student" labels) and handles the small, mixed-scale feature set
   well.
3. Scoring: sklearn's ``score_samples`` returns the (negated) mean path length;
   lower = more anomalous. We convert that to a bounded 0..1 anomaly score so it
   is directly comparable with the rule-based detectors and the shared
   ``alert_threshold``.
4. Standardization: features are z-scored (StandardScaler) before fitting so no
   single large-magnitude feature dominates the random splits.

Why this is machine learning (not another heuristic): the decision boundary is
*learned from the data distribution* at run time rather than written by hand.
The same code produces different flags as the cohort's behavior shifts, because
"normal" is defined relative to the peers in the current window, not a fixed
constant. The model is trained on every analysis call (the dataset is small —
tens to low-hundreds of students — so a fresh fit is cheap and always current).

Graceful degradation: scikit-learn is an optional dependency. If it is not
installed, or the cohort is too small to learn a distribution, the detector
returns no alerts (and logs why) instead of raising, so the engine keeps
serving the rule-based detectors.
"""

import logging
from datetime import datetime, timedelta

from src.db.connection import connection
from src.detectors.base import BaseDetector

logger = logging.getLogger(__name__)

# Imported lazily/defensively so a missing optional dependency never crashes
# the whole engine on import.
try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    _SKLEARN_AVAILABLE = True
except Exception as _import_err:  # pragma: no cover - environment dependent
    np = None
    IsolationForest = None
    StandardScaler = None
    _SKLEARN_AVAILABLE = False
    logger.warning(
        "scikit-learn unavailable; MLBehaviorDetector disabled: %s", _import_err
    )


# Order matters: this is the column order of every feature vector.
FEATURE_NAMES = [
    "attendance_count",      # total attended sessions in window
    "tardy_ratio",           # fraction of records flagged tardy
    "absent_ratio",          # fraction of scheduled records with no check-in
    "recent_activity_ratio", # last-7-day attendance vs. window weekly average
    "avg_arrival_minutes",   # mean check-in time (minutes past midnight)
    "arrival_std_minutes",   # std-dev of check-in time (consistency)
    "mean_gap_days",         # mean days between consecutive attended sessions
    "sessions_used_ratio",   # (MAX_SESSIONS - remaining) / MAX_SESSIONS
]

MAX_SESSIONS = 4

# Short-lived process cache of the fitted cohort model. Building the feature
# matrix and fitting the forest is the expensive part; in a batch run every
# student triggers detect(), so without this cache we'd rebuild + refit once
# per student (O(n^2)). The cache keys on the window so a single batch run fits
# exactly once, and the short TTL keeps live single-event scoring reasonably
# fresh as new attendance arrives.
_MODEL_CACHE = {"window_days": None, "built_at": None, "payload": None}
_CACHE_TTL_SECONDS = 60


class MLBehaviorDetector(BaseDetector):
    """Unsupervised Isolation Forest over per-student behavioral features."""

    PATTERN_TYPE = "ml_behavioral"

    # Isolation Forest needs a cohort to learn a distribution. Below this many
    # students there is nothing meaningful to compare against.
    MIN_COHORT = 8

    # Expected proportion of outliers. Kept modest so the model doesn't flag a
    # large fraction of the class; the final alert still has to clear the shared
    # alert_threshold, so this mainly shapes the contamination prior.
    CONTAMINATION = 0.1

    def detect(self, student_id, event, config):
        """Score ``student_id`` against the learned cohort model.

        Args:
            student_id: int - the student to score.
            event: dict - triggering event (student_name read for the message).
            config: dict - loaded config; ``historical_window_days`` is used.

        Returns:
            list with a single alert dict if the student is a learned outlier,
            otherwise an empty list.
        """
        if not _SKLEARN_AVAILABLE:
            return []

        window_days = int(config.get("historical_window_days", 30))

        try:
            fit = self._get_or_build_model(window_days)
        except Exception as e:  # pragma: no cover - DB failure path
            logger.error("MLBehaviorDetector model build failed: %s", e)
            return []

        if fit is None:
            return []  # cohort too small — already logged in builder

        index = fit["index"]  # student_id -> row position
        if student_id not in index:
            return []
        target_idx = index[student_id]

        raw_scores = fit["raw_scores"]
        predictions = fit["predictions"]

        if predictions[target_idx] != -1:
            return []  # inlier — not anomalous

        target_raw = float(raw_scores[target_idx])
        anomaly_score = self._normalize_score(target_raw, raw_scores)

        student_name = event.get("student_name", "Unknown")
        features = fit["features"][target_idx]
        description = self._describe(student_name, features, anomaly_score)

        return [
            {
                "student_id": student_id,
                "student_name": student_name,
                "pattern_type": self.PATTERN_TYPE,
                "score": round(anomaly_score, 4),
                "description": description,
                "detected_at": datetime.now().isoformat(),
            }
        ]

    # ------------------------------------------------------------------ #
    # Model fit (cached per window)
    # ------------------------------------------------------------------ #
    def _get_or_build_model(self, window_days):
        """Return a cached cohort fit, or build (and cache) a fresh one.

        The returned payload is a dict with:
            index       - {student_id: row_index}
            features    - list of raw feature vectors (for descriptions)
            raw_scores  - np.ndarray of Isolation Forest score_samples
            predictions - np.ndarray of -1/1 outlier flags
        Returns None if the cohort is too small to model.
        """
        now = datetime.now()
        cached = _MODEL_CACHE
        if (
            cached["payload"] is not None
            and cached["window_days"] == window_days
            and cached["built_at"] is not None
            and (now - cached["built_at"]).total_seconds() < _CACHE_TTL_SECONDS
        ):
            return cached["payload"]

        feature_rows = self._build_feature_matrix(window_days)

        if len(feature_rows) < self.MIN_COHORT:
            logger.debug(
                "MLBehaviorDetector: cohort too small (%d < %d), skipping",
                len(feature_rows),
                self.MIN_COHORT,
            )
            _MODEL_CACHE.update(
                {"window_days": window_days, "built_at": now, "payload": None}
            )
            return None

        matrix = np.array([r["features"] for r in feature_rows], dtype=float)

        # Standardize so mixed-scale features (counts vs. ratios vs. minutes)
        # contribute comparably to the random partitioning.
        scaler = StandardScaler()
        matrix_scaled = scaler.fit_transform(matrix)

        model = IsolationForest(
            n_estimators=100,
            contamination=self.CONTAMINATION,
            random_state=42,  # reproducible for a thesis defense
        )
        model.fit(matrix_scaled)

        payload = {
            "index": {r["student_id"]: i for i, r in enumerate(feature_rows)},
            "features": [r["features"] for r in feature_rows],
            # score_samples: higher = more normal, lower = more anomalous.
            "raw_scores": model.score_samples(matrix_scaled),
            "predictions": model.predict(matrix_scaled),  # -1 outlier, 1 inlier
        }

        _MODEL_CACHE.update(
            {"window_days": window_days, "built_at": now, "payload": payload}
        )
        return payload

    # ------------------------------------------------------------------ #
    # Score normalization
    # ------------------------------------------------------------------ #
    @staticmethod
    def _normalize_score(target_raw, raw_scores):
        """Map an Isolation Forest raw score to a 0..1 anomaly score.

        ``score_samples`` is unbounded and higher = more normal. We invert and
        min-max scale against the current cohort so the most anomalous student
        in the batch sits near 1.0 and the most normal near 0.0. Scaling within
        the cohort (rather than against a fixed constant) keeps the score
        meaningful as the distribution shifts.
        """
        lo = float(np.min(raw_scores))
        hi = float(np.max(raw_scores))
        if hi == lo:
            return 0.0
        # Invert: lower raw score (more anomalous) -> higher normalized score.
        normalized = (hi - target_raw) / (hi - lo)
        return float(min(1.0, max(0.0, normalized)))

    # ------------------------------------------------------------------ #
    # Feature engineering
    # ------------------------------------------------------------------ #
    def _build_feature_matrix(self, window_days):
        """Build one feature vector per active student over the window.

        Returns a list of dicts: {student_id, student_name, features: [...]}.
        A single pass per student keeps this O(students) round trips; for the
        academy's cohort size that is well within budget.
        """
        window_start = (datetime.now() - timedelta(days=window_days)).date()
        seven_days_ago = (datetime.now() - timedelta(days=7)).date()

        rows = []
        with connection() as conn:
            cursor = conn.cursor(dictionary=True)

            cursor.execute(
                "SELECT student_id, student_name, remaining_sessions "
                "FROM students "
                "WHERE is_archived = 0 OR is_archived IS NULL"
            )
            students = cursor.fetchall()

            for s in students:
                sid = s["student_id"]
                features = self._student_features(
                    cursor, sid, s, window_start, seven_days_ago, window_days
                )
                if features is None:
                    continue
                rows.append(
                    {
                        "student_id": sid,
                        "student_name": s.get("student_name", "Unknown"),
                        "features": features,
                    }
                )

            cursor.close()

        return rows

    def _student_features(
        self, cursor, student_id, student_row, window_start, seven_days_ago, window_days
    ):
        """Compute the feature vector for one student, or None if no history."""
        cursor.execute(
            "SELECT date, time_in, attendance_flag "
            "FROM attendance_logs "
            "WHERE student_id = %s AND date >= %s "
            "ORDER BY date ASC",
            (student_id, window_start),
        )
        logs = cursor.fetchall()

        if not logs:
            return None

        total_records = len(logs)
        attended = [r for r in logs if r.get("time_in") is not None]
        attendance_count = len(attended)
        tardy_count = sum(1 for r in logs if r.get("attendance_flag") == "tardy")
        absent_count = sum(1 for r in logs if r.get("time_in") is None)

        tardy_ratio = tardy_count / total_records if total_records else 0.0
        absent_ratio = absent_count / total_records if total_records else 0.0

        # Recent activity vs. window weekly average.
        weeks = max(window_days / 7.0, 1.0)
        avg_weekly = attendance_count / weeks
        recent_count = sum(
            1 for r in attended if self._as_date(r["date"]) >= seven_days_ago
        )
        recent_activity_ratio = (recent_count / avg_weekly) if avg_weekly > 0 else 0.0

        # Arrival-time distribution (minutes past midnight).
        arrival_minutes = [
            self._time_to_minutes(r["time_in"]) for r in attended if r.get("time_in")
        ]
        arrival_minutes = [m for m in arrival_minutes if m is not None]
        if arrival_minutes:
            avg_arrival = float(np.mean(arrival_minutes))
            arrival_std = float(np.std(arrival_minutes))
        else:
            avg_arrival = 0.0
            arrival_std = 0.0

        # Mean gap (days) between consecutive attended sessions — a proxy for
        # cadence regularity.
        attended_dates = sorted(
            {self._as_date(r["date"]) for r in attended if r.get("date")}
        )
        if len(attended_dates) >= 2:
            gaps = [
                (attended_dates[i] - attended_dates[i - 1]).days
                for i in range(1, len(attended_dates))
            ]
            mean_gap_days = float(np.mean(gaps))
        else:
            mean_gap_days = float(window_days)  # one or zero sessions = large gap

        remaining = student_row.get("remaining_sessions")
        if remaining is None:
            sessions_used_ratio = 0.0
        else:
            used = max(0, MAX_SESSIONS - int(remaining))
            sessions_used_ratio = used / float(MAX_SESSIONS)

        return [
            float(attendance_count),
            float(tardy_ratio),
            float(absent_ratio),
            float(recent_activity_ratio),
            float(avg_arrival),
            float(arrival_std),
            float(mean_gap_days),
            float(sessions_used_ratio),
        ]

    # ------------------------------------------------------------------ #
    # Human-readable explanation
    # ------------------------------------------------------------------ #
    @staticmethod
    def _describe(student_name, features, score):
        """Build a plain-language description naming the top deviating traits.

        We can't expose raw Isolation Forest internals to an admin, so we
        surface the two most notable raw features as the "why".
        """
        named = dict(zip(FEATURE_NAMES, features))
        reasons = []
        if named["tardy_ratio"] >= 0.4:
            reasons.append(f"{named['tardy_ratio']:.0%} tardy rate")
        if named["absent_ratio"] >= 0.3:
            reasons.append(f"{named['absent_ratio']:.0%} missed scheduled sessions")
        if named["recent_activity_ratio"] <= 0.4:
            reasons.append("sharp drop in recent activity")
        if named["arrival_std_minutes"] >= 45:
            reasons.append("highly irregular arrival times")
        if named["mean_gap_days"] >= 14:
            reasons.append("long gaps between sessions")

        why = "; ".join(reasons) if reasons else "an unusual combination of behaviors"
        return (
            f"ML model flagged {student_name} as a behavioral outlier "
            f"(anomaly score {score:.2f}) relative to the current cohort: {why}."
        )

    # ------------------------------------------------------------------ #
    # Small helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _as_date(value):
        """Normalize a DB date/datetime/string to a date object."""
        if isinstance(value, datetime):
            return value.date()
        if hasattr(value, "year") and not isinstance(value, str):
            return value  # already a date
        if isinstance(value, str):
            try:
                return datetime.strptime(value[:10], "%Y-%m-%d").date()
            except ValueError:
                return datetime.now().date()
        return datetime.now().date()

    @staticmethod
    def _time_to_minutes(value):
        """Convert a TIME/timedelta/string check-in value to minutes past midnight."""
        # mysql-connector returns TIME as datetime.timedelta
        if isinstance(value, timedelta):
            return int(value.total_seconds() // 60)
        if isinstance(value, str):
            parts = value.split(":")
            if len(parts) >= 2:
                try:
                    return int(parts[0]) * 60 + int(parts[1])
                except ValueError:
                    return None
        if hasattr(value, "hour") and hasattr(value, "minute"):
            return value.hour * 60 + value.minute
        return None
