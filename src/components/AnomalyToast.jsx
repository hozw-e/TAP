import { useEffect, useState, useRef, useCallback } from 'react';
import '../styles/AnomalyToast.css';

const AUTO_DISMISS_MS = 10000;

/**
 * Format pattern_type from snake_case to Title Case.
 * e.g. "chronic_tardiness" → "Chronic Tardiness"
 */
function formatPatternType(patternType) {
  if (!patternType) return '';
  return patternType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the icon class for a given pattern type.
 */
function getPatternIcon(patternType) {
  switch (patternType) {
    case 'chronic_tardiness':
      return 'fas fa-clock';
    case 'attendance_dropoff':
      return 'fas fa-chart-line-down';
    case 'irregular_timing':
      return 'fas fa-random';
    case 'early_departure':
      return 'fas fa-sign-out-alt';
    default:
      return 'fas fa-exclamation-triangle';
  }
}

/**
 * Individual toast item that handles its own auto-dismiss timer.
 */
function AnomalyToastItem({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss after 10 seconds
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(showTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    // Wait for exit animation to finish before calling onDismiss
    setTimeout(() => {
      onDismiss();
    }, 300);
  }, [onDismiss]);

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleDismiss();
  };

  return (
    <div
      className={`anomaly-toast-item ${visible ? 'show' : ''}`}
      onClick={handleClick}
      role="alert"
      aria-live="polite"
    >
      <div className="anomaly-toast-icon">
        <i className={getPatternIcon(alert.pattern_type)}></i>
      </div>
      <div className="anomaly-toast-content">
        <div className="anomaly-toast-header">
          <strong className="anomaly-toast-student">{alert.student_name}</strong>
          <span className="anomaly-toast-pattern">{formatPatternType(alert.pattern_type)}</span>
        </div>
        <p className="anomaly-toast-description">{alert.description}</p>
      </div>
      <button
        className="anomaly-toast-close"
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        aria-label="Dismiss notification"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}

/**
 * AnomalyToastContainer manages the stack of visible toast notifications.
 * Newest toasts appear at the top.
 *
 * @param {Object} props
 * @param {Array} props.alerts - Array of new alert objects to show as toasts
 * @param {Function} props.onDismiss - Callback when a toast is dismissed, receives alert index
 */
function AnomalyToastContainer({ alerts, onDismiss }) {
  return (
    <div className="anomaly-toast-container" aria-label="Anomaly notifications">
      {alerts.map((alert, idx) => (
        <AnomalyToastItem
          key={`${alert.student_id}-${alert.pattern_type}-${alert.detected_at || idx}`}
          alert={alert}
          onDismiss={() => onDismiss(idx)}
        />
      ))}
    </div>
  );
}

export { AnomalyToastContainer, AnomalyToastItem, formatPatternType, getPatternIcon };
export default AnomalyToastContainer;
