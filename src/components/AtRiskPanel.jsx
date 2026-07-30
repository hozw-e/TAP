import { useNavigate } from 'react-router-dom';
import '../styles/AtRiskPanel.css';

const MAX_VISIBLE = 20;

/**
 * Map a score to its severity color class.
 * 0.7 <= s < 0.8 → yellow (warning)
 * 0.8 <= s < 0.9 → orange (elevated)
 * 0.9 <= s <= 1.0 → red (critical)
 */
export function getSeverityColor(score) {
  if (score >= 0.9) return 'critical';
  if (score >= 0.8) return 'elevated';
  if (score >= 0.7) return 'warning';
  return 'warning';
}

/**
 * Get icon class for a pattern type.
 */
function getPatternIcon(patternType) {
  switch (patternType) {
    case 'chronic_tardiness':
      return 'fas fa-clock';
    case 'attendance_dropoff':
      return 'fas fa-chart-line';
    case 'irregular_timing':
      return 'fas fa-random';
    case 'early_departure':
      return 'fas fa-sign-out-alt';
    default:
      return 'fas fa-exclamation-triangle';
  }
}

/**
 * Format pattern_type from snake_case to Title Case.
 */
function formatPatternType(patternType) {
  if (!patternType) return '';
  return patternType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * AtRiskPanel displays today's anomaly alerts sorted by score DESC.
 *
 * @param {{ alerts: Array, onDismiss: Function }} props
 * - alerts: sorted array of anomaly alert objects
 * - onDismiss: optional callback to dismiss an alert
 */
function AtRiskPanel({ alerts }) {
  const navigate = useNavigate();

  const handleAlertClick = (alert) => {
    navigate(`/students/${alert.student_id}`);
  };

  return (
    <div className="at-risk-panel">
      <div className="at-risk-panel-title">
        <i className="fas fa-exclamation-triangle"></i>
        <span>At-Risk Students</span>
        {alerts.length > 0 && (
          <span className="at-risk-badge">{alerts.length}</span>
        )}
      </div>
      <div className="at-risk-panel-content">
        {alerts.length === 0 ? (
          <span className="at-risk-empty">No at-risk students detected today</span>
        ) : (
          <div className="at-risk-list">
            {alerts.slice(0, MAX_VISIBLE).map((alert, idx) => (
              <div
                key={`${alert.student_id}-${alert.pattern_type}-${idx}`}
                className="at-risk-item"
                onClick={() => handleAlertClick(alert)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAlertClick(alert); }}
              >
                <div className="at-risk-item-icon">
                  <i className={getPatternIcon(alert.pattern_type)}></i>
                </div>
                <div className="at-risk-item-info">
                  <div className="at-risk-item-header">
                    <strong className="at-risk-student-name">{alert.student_name}</strong>
                    <span className="at-risk-pattern">{formatPatternType(alert.pattern_type)}</span>
                  </div>
                  <p className="at-risk-description">{alert.description}</p>
                  <div className={`at-risk-severity-bar severity-${getSeverityColor(alert.score)}`}>
                    <div
                      className="at-risk-severity-fill"
                      style={{ width: `${Math.round(alert.score * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="at-risk-item-score">
                  <span className={`score-value severity-text-${getSeverityColor(alert.score)}`}>
                    {alert.score.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {alerts.length > MAX_VISIBLE && (
              <div className="at-risk-overflow">
                +{alerts.length - MAX_VISIBLE} more alerts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AtRiskPanel;
