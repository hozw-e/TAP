import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_ALERTS = 100;

/**
 * Sort alerts by score DESC, ties broken by detected_at DESC.
 * @param {Array} alerts
 * @returns {Array} sorted copy
 */
export function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.detected_at) - new Date(a.detected_at);
  });
}

/**
 * Insert a new alert into an already-sorted list, maintaining sort order.
 * Returns a new array (does not mutate input).
 * @param {Array} sortedAlerts - already sorted by score DESC, detected_at DESC
 * @param {object} newAlert - alert object to insert
 * @returns {Array} new sorted array with the alert inserted
 */
export function insertAlertSorted(sortedAlerts, newAlert) {
  const result = [...sortedAlerts];
  let insertIdx = result.length;

  for (let i = 0; i < result.length; i++) {
    const existing = result[i];
    if (newAlert.score > existing.score) {
      insertIdx = i;
      break;
    } else if (newAlert.score === existing.score) {
      if (new Date(newAlert.detected_at) >= new Date(existing.detected_at)) {
        insertIdx = i;
        break;
      }
    }
  }

  result.splice(insertIdx, 0, newAlert);

  // Cap at MAX_ALERTS
  if (result.length > MAX_ALERTS) {
    result.length = MAX_ALERTS;
  }

  return result;
}

/**
 * Check if an alert is a duplicate of an existing alert in the list.
 * Duplicate = same student_id AND same pattern_type within the session.
 * @param {Array} existingAlerts
 * @param {object} newAlert
 * @returns {boolean}
 */
export function isDuplicate(existingAlerts, newAlert) {
  return existingAlerts.some(
    a => a.student_id === newAlert.student_id && a.pattern_type === newAlert.pattern_type
  );
}

/**
 * Custom hook for managing anomaly alerts state.
 * Subscribes to anomaly_alert messages and maintains a sorted, deduplicated list.
 *
 * @param {object|null} lastMessage - The last message received from useWebSocket
 * @returns {{ alerts: Array, addAlert: Function, clearAlerts: Function, dismissAlert: Function }}
 */
export function useAnomalyAlerts(lastMessage) {
  const [alerts, setAlerts] = useState([]);
  const deduplicationSetRef = useRef(new Set());

  // Subscribe to anomaly_alert messages from useWebSocket
  useEffect(() => {
    if (!lastMessage) return;

    let parsed = lastMessage;
    if (typeof lastMessage === 'string') {
      try {
        parsed = JSON.parse(lastMessage);
      } catch {
        return;
      }
    }

    if (parsed.type !== 'anomaly_alert' || !parsed.data) return;

    const alertData = parsed.data;

    // Client-side deduplication: same student + pattern within session
    const dedupeKey = `${alertData.student_id}:${alertData.pattern_type}`;
    if (deduplicationSetRef.current.has(dedupeKey)) {
      return;
    }

    deduplicationSetRef.current.add(dedupeKey);

    setAlerts(prev => insertAlertSorted(prev, alertData));
  }, [lastMessage]);

  /**
   * Manually add an alert (used internally or externally).
   * Respects deduplication.
   */
  const addAlert = useCallback((alert) => {
    const dedupeKey = `${alert.student_id}:${alert.pattern_type}`;
    if (deduplicationSetRef.current.has(dedupeKey)) {
      return;
    }
    deduplicationSetRef.current.add(dedupeKey);
    setAlerts(prev => insertAlertSorted(prev, alert));
  }, []);

  /**
   * Clear all alerts (e.g., on day change).
   * Also resets the deduplication tracking.
   */
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    deduplicationSetRef.current.clear();
  }, []);

  /**
   * Dismiss (remove) a specific alert by its index or matching properties.
   * @param {number|string} alertId - index in the alerts array, or a unique identifier
   */
  const dismissAlert = useCallback((alertId) => {
    setAlerts(prev => {
      if (typeof alertId === 'number') {
        // Treat as index
        const dismissed = prev[alertId];
        if (dismissed) {
          const dedupeKey = `${dismissed.student_id}:${dismissed.pattern_type}`;
          deduplicationSetRef.current.delete(dedupeKey);
        }
        return prev.filter((_, idx) => idx !== alertId);
      }
      // Treat as a string identifier (student_id:pattern_type)
      deduplicationSetRef.current.delete(alertId);
      return prev.filter(a => `${a.student_id}:${a.pattern_type}` !== alertId);
    });
  }, []);

  return { alerts, addAlert, clearAlerts, dismissAlert };
}
