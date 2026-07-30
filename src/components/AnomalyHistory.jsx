import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import '../styles/AnomalyHistory.css';

const PATTERN_TYPES = [
  { value: '', label: 'All Pattern Types' },
  { value: 'chronic_tardiness', label: 'Chronic Tardiness' },
  { value: 'attendance_dropoff', label: 'Attendance Dropoff' },
  { value: 'irregular_timing', label: 'Irregular Timing' },
  { value: 'early_departure', label: 'Early Departure' },
];

const PER_PAGE = 20;
const MAX_DATE_RANGE_DAYS = 365;

/**
 * Compute the trend for a specific pattern type from a set of alerts.
 * Compares average score of the last 2 weeks vs the prior 2 weeks.
 *
 * @param {Array} alerts - Array of alert objects with { score, detected_at, pattern_type }
 * @param {string} patternType - The pattern type to compute trend for
 * @returns {{ trend: 'improving'|'worsening'|'stable'|'insufficient', diff: number }}
 */
export function computeTrend(alerts, patternType) {
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Filter alerts for this pattern in the last 4 weeks
  const recentAlerts = alerts.filter((alert) => {
    if (alert.pattern_type !== patternType) return false;
    const alertDate = new Date(alert.detected_at);
    return alertDate >= fourWeeksAgo && alertDate <= now;
  });

  // Need at least 2 alerts in last 4 weeks
  if (recentAlerts.length < 2) {
    return { trend: 'insufficient', diff: 0 };
  }

  // Split into recent 2 weeks and prior 2 weeks
  const recentTwoWeeks = recentAlerts.filter((a) => new Date(a.detected_at) >= twoWeeksAgo);
  const priorTwoWeeks = recentAlerts.filter((a) => {
    const d = new Date(a.detected_at);
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  });

  // Need data in both periods to compute a meaningful trend
  if (recentTwoWeeks.length === 0 || priorTwoWeeks.length === 0) {
    return { trend: 'insufficient', diff: 0 };
  }

  const recentAvg = recentTwoWeeks.reduce((sum, a) => sum + a.score, 0) / recentTwoWeeks.length;
  const priorAvg = priorTwoWeeks.reduce((sum, a) => sum + a.score, 0) / priorTwoWeeks.length;
  const diff = recentAvg - priorAvg;

  if (diff > 0.1) return { trend: 'worsening', diff };
  if (diff < -0.1) return { trend: 'improving', diff };
  return { trend: 'stable', diff };
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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * AnomalyHistory displays historical anomaly alerts for a student.
 * Fetches from GET /api/anomaly/alerts.php with pagination, filtering, and trend indicators.
 *
 * @param {{ studentId: number }} props
 */
function AnomalyHistory({ studentId }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [patternTypeFilter, setPatternTypeFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dateError, setDateError] = useState('');

  // All alerts for trend computation (fetched without pagination)
  const [allAlerts, setAllAlerts] = useState([]);

  const validateDateRange = useCallback((start, end) => {
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (startDate > endDate) {
        return 'Start date must be before end date';
      }
      const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        return `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`;
      }
    }
    return '';
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('student_id', studentId);
      params.set('page', page);

      if (patternTypeFilter) {
        params.set('pattern_type', patternTypeFilter);
      }
      if (dateStart) {
        params.set('date_start', dateStart);
      }
      if (dateEnd) {
        params.set('date_end', dateEnd);
      }

      const response = await api.get(`/anomaly/alerts.php?${params.toString()}`);
      const data = response.data;

      if (data.success) {
        setAlerts(data.alerts || []);
        setTotalPages(data.pagination?.total_pages || 0);
        setTotal(data.pagination?.total || 0);
      } else {
        setAlerts([]);
        setTotalPages(0);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching anomaly alerts:', err);
      setError('Failed to load anomaly history');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, page, patternTypeFilter, dateStart, dateEnd]);

  // Fetch all alerts (unpaginated) for trend computation
  const fetchAllAlertsForTrend = useCallback(async () => {
    if (!studentId) return;
    try {
      // Fetch last 4 weeks of alerts for trend computation
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const params = new URLSearchParams();
      params.set('student_id', studentId);
      params.set('date_start', fourWeeksAgo.toISOString().slice(0, 10));
      params.set('date_end', new Date().toISOString().slice(0, 10));
      params.set('page', '1');

      // Fetch up to the max possible - we use a large page approach
      // The API caps at 20 per page, so we fetch multiple pages
      let allFetched = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        params.set('page', currentPage);
        const response = await api.get(`/anomaly/alerts.php?${params.toString()}`);
        const data = response.data;
        if (data.success && data.alerts?.length > 0) {
          allFetched = [...allFetched, ...data.alerts];
          hasMore = currentPage < (data.pagination?.total_pages || 0);
          currentPage++;
        } else {
          hasMore = false;
        }
      }

      setAllAlerts(allFetched);
    } catch (err) {
      console.error('Error fetching alerts for trend:', err);
      setAllAlerts([]);
    }
  }, [studentId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAllAlertsForTrend();
  }, [fetchAllAlertsForTrend]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [patternTypeFilter, dateStart, dateEnd]);

  const handleDateStartChange = (value) => {
    setDateStart(value);
    const err = validateDateRange(value, dateEnd);
    setDateError(err);
  };

  const handleDateEndChange = (value) => {
    setDateEnd(value);
    const err = validateDateRange(dateStart, value);
    setDateError(err);
  };

  // Compute trends for each pattern type
  const trends = useMemo(() => {
    const patternTypes = ['chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure'];
    const result = {};
    for (const pt of patternTypes) {
      result[pt] = computeTrend(allAlerts, pt);
    }
    return result;
  }, [allAlerts]);

  const renderTrendIndicator = (patternType) => {
    const { trend } = trends[patternType] || { trend: 'insufficient' };
    switch (trend) {
      case 'improving':
        return <span className="trend-indicator trend-improving" title="Improving">↓ Improving</span>;
      case 'worsening':
        return <span className="trend-indicator trend-worsening" title="Worsening">↑ Worsening</span>;
      case 'stable':
        return <span className="trend-indicator trend-stable" title="Stable">→ Stable</span>;
      case 'insufficient':
      default:
        return <span className="trend-indicator trend-insufficient" title="Insufficient data">Insufficient data</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="anomaly-history">
      <div className="anomaly-history-header">
        <div className="anomaly-history-title">
          <i className="fas fa-exclamation-triangle"></i>
          <span>Anomaly Detection History</span>
        </div>
      </div>

      {/* Trend indicators */}
      <div className="anomaly-trends">
        {PATTERN_TYPES.filter((pt) => pt.value !== '').map((pt) => (
          <div key={pt.value} className="anomaly-trend-item">
            <div className="anomaly-trend-label">
              <i className={getPatternIcon(pt.value)}></i>
              <span>{pt.label}</span>
            </div>
            {renderTrendIndicator(pt.value)}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="anomaly-history-filters">
        <div className="anomaly-filter-group">
          <label>Pattern Type</label>
          <select
            value={patternTypeFilter}
            onChange={(e) => setPatternTypeFilter(e.target.value)}
            className="anomaly-filter-select"
          >
            {PATTERN_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="anomaly-filter-group">
          <label>From</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => handleDateStartChange(e.target.value)}
            className="anomaly-filter-date"
          />
        </div>
        <div className="anomaly-filter-group">
          <label>To</label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => handleDateEndChange(e.target.value)}
            className="anomaly-filter-date"
          />
        </div>
      </div>
      {dateError && <div className="anomaly-date-error">{dateError}</div>}

      {/* Content */}
      <div className="anomaly-history-content">
        {loading ? (
          <div className="anomaly-history-loading">
            <div className="spinner"></div>
            <p>Loading anomaly history...</p>
          </div>
        ) : error ? (
          <div className="anomaly-history-error">
            <i className="fas fa-exclamation-circle"></i>
            <p>{error}</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="anomaly-history-empty">
            <i className="fas fa-check-circle"></i>
            <p>No anomalies detected for this student</p>
          </div>
        ) : (
          <>
            <table className="anomaly-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pattern</th>
                  <th>Score</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.alert_id}>
                    <td className="anomaly-date-cell">
                      <div>{formatDate(alert.detected_at)}</div>
                      <div className="anomaly-time">{formatTime(alert.detected_at)}</div>
                    </td>
                    <td>
                      <span className="anomaly-pattern-badge">
                        <i className={getPatternIcon(alert.pattern_type)}></i>
                        {formatPatternType(alert.pattern_type)}
                      </span>
                    </td>
                    <td>
                      <span className={`anomaly-score score-${getScoreLevel(alert.score)}`}>
                        {alert.score.toFixed(2)}
                      </span>
                    </td>
                    <td className="anomaly-description-cell">{alert.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="anomaly-history-pagination">
                <span className="anomaly-pagination-info">
                  Showing {(page - 1) * PER_PAGE + 1}-{Math.min(page * PER_PAGE, total)} of {total} alerts
                </span>
                <div className="anomaly-pagination-controls">
                  <button
                    className="anomaly-pagination-btn"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  {getPageNumbers().map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="anomaly-pagination-ellipsis">...</span>
                    ) : (
                      <button
                        key={p}
                        className={`anomaly-pagination-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    className="anomaly-pagination-btn"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Get score severity level for styling.
 */
function getScoreLevel(score) {
  if (score >= 0.9) return 'critical';
  if (score >= 0.8) return 'elevated';
  if (score >= 0.7) return 'warning';
  return 'low';
}

export default AnomalyHistory;
