import { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/AnomalyConfig.css';

const ALL_PATTERNS = [
  { id: 'chronic_tardiness', label: 'Chronic Tardiness', icon: 'fas fa-clock' },
  { id: 'attendance_dropoff', label: 'Attendance Dropoff', icon: 'fas fa-chart-line' },
  { id: 'irregular_timing', label: 'Irregular Timing', icon: 'fas fa-random' },
  { id: 'early_departure', label: 'Early Departure', icon: 'fas fa-sign-out-alt' },
];

/**
 * Validate alert threshold value.
 * Must be a number between 0.5 and 1.0.
 * @param {number|string} value
 * @returns {{ valid: boolean, message: string }}
 */
export function validateThreshold(value) {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, message: 'Threshold must be a number' };
  }
  if (num < 0.5 || num > 1.0) {
    return { valid: false, message: 'Threshold must be between 0.5 and 1.0' };
  }
  return { valid: true, message: '' };
}

/**
 * Validate historical window value.
 * Must be an integer between 7 and 90.
 * @param {number|string} value
 * @returns {{ valid: boolean, message: string }}
 */
export function validateWindow(value) {
  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, message: 'Window must be a whole number' };
  }
  if (num < 7 || num > 90) {
    return { valid: false, message: 'Window must be between 7 and 90 days' };
  }
  return { valid: true, message: '' };
}

/**
 * AnomalyConfig — Settings page for anomaly detection parameters.
 * Loads current config on mount and allows saving updated values.
 */
function AnomalyConfig() {
  const [threshold, setThreshold] = useState(0.7);
  const [windowDays, setWindowDays] = useState(30);
  const [enabledPatterns, setEnabledPatterns] = useState(ALL_PATTERNS.map(p => p.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [errors, setErrors] = useState({ threshold: '', window: '' });

  // Load current configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const response = await api.get('/anomaly/config.php');
      const data = response.data;
      setThreshold(data.alert_threshold);
      setWindowDays(data.historical_window_days);
      setEnabledPatterns(data.enabled_patterns || []);
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  }

  function handleThresholdChange(value) {
    setThreshold(value);
    const result = validateThreshold(value);
    setErrors(prev => ({ ...prev, threshold: result.valid ? '' : result.message }));
  }

  function handleWindowChange(value) {
    setWindowDays(value);
    const result = validateWindow(value);
    setErrors(prev => ({ ...prev, window: result.valid ? '' : result.message }));
  }

  function handlePatternToggle(patternId) {
    setEnabledPatterns(prev => {
      if (prev.includes(patternId)) {
        return prev.filter(p => p !== patternId);
      }
      return [...prev, patternId];
    });
  }

  async function handleSave() {
    // Run validation before saving
    const thresholdResult = validateThreshold(threshold);
    const windowResult = validateWindow(windowDays);

    setErrors({
      threshold: thresholdResult.valid ? '' : thresholdResult.message,
      window: windowResult.valid ? '' : windowResult.message,
    });

    if (!thresholdResult.valid || !windowResult.valid) {
      return;
    }

    try {
      setSaving(true);
      setNotification(null);
      await api.put('/anomaly/config.php', {
        alert_threshold: Number(threshold),
        historical_window_days: Number(windowDays),
        enabled_patterns: enabledPatterns,
      });
      setNotification({ type: 'success', message: 'Settings saved successfully' });
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="anomaly-config">
        <div className="anomaly-config-loading">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="anomaly-config">
      <div className="anomaly-config-header">
        <h2>
          <i className="fas fa-cog"></i>
          Anomaly Detection Settings
        </h2>
        <p className="anomaly-config-description">
          Configure detection sensitivity, analysis window, and enabled patterns.
        </p>
      </div>

      {notification && (
        <div className={`anomaly-config-notification anomaly-config-notification--${notification.type}`}>
          <i className={notification.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'}></i>
          {notification.message}
        </div>
      )}

      <div className="anomaly-config-section">
        <label className="anomaly-config-label" htmlFor="threshold-input">
          Alert Threshold
        </label>
        <p className="anomaly-config-hint">
          Minimum anomaly score to trigger an alert (0.5 – 1.0)
        </p>
        <div className="anomaly-config-threshold-controls">
          <input
            id="threshold-slider"
            type="range"
            min="0.5"
            max="1.0"
            step="0.01"
            value={threshold}
            onChange={(e) => handleThresholdChange(e.target.value)}
            className="anomaly-config-slider"
            aria-label="Alert threshold slider"
          />
          <input
            id="threshold-input"
            type="number"
            min="0.5"
            max="1.0"
            step="0.01"
            value={threshold}
            onChange={(e) => handleThresholdChange(e.target.value)}
            className={`anomaly-config-number-input${errors.threshold ? ' input-error' : ''}`}
            aria-describedby="threshold-error"
          />
        </div>
        {errors.threshold && (
          <span id="threshold-error" className="anomaly-config-error" role="alert">
            {errors.threshold}
          </span>
        )}
      </div>

      <div className="anomaly-config-section">
        <label className="anomaly-config-label" htmlFor="window-input">
          Historical Window
        </label>
        <p className="anomaly-config-hint">
          Number of days to analyze for pattern detection (7 – 90)
        </p>
        <div className="anomaly-config-window-controls">
          <input
            id="window-input"
            type="number"
            min="7"
            max="90"
            step="1"
            value={windowDays}
            onChange={(e) => handleWindowChange(e.target.value)}
            className={`anomaly-config-number-input${errors.window ? ' input-error' : ''}`}
            aria-describedby="window-error"
          />
          <span className="anomaly-config-unit">days</span>
        </div>
        {errors.window && (
          <span id="window-error" className="anomaly-config-error" role="alert">
            {errors.window}
          </span>
        )}
      </div>

      <div className="anomaly-config-section">
        <label className="anomaly-config-label">
          Enabled Patterns
        </label>
        <p className="anomaly-config-hint">
          Select which anomaly patterns to detect
        </p>
        <div className="anomaly-config-patterns">
          {ALL_PATTERNS.map((pattern) => (
            <label
              key={pattern.id}
              className={`anomaly-config-pattern-toggle${enabledPatterns.includes(pattern.id) ? ' active' : ''}`}
            >
              <input
                type="checkbox"
                checked={enabledPatterns.includes(pattern.id)}
                onChange={() => handlePatternToggle(pattern.id)}
                aria-label={`Enable ${pattern.label}`}
              />
              <i className={pattern.icon}></i>
              <span>{pattern.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="anomaly-config-actions">
        <button
          className="anomaly-config-save-btn"
          onClick={handleSave}
          disabled={saving || !!errors.threshold || !!errors.window}
          type="button"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default AnomalyConfig;
