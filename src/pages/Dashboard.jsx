import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import Notification from '../components/Notification';
import VisitTrendGraph from '../components/VisitTrendGraph';
import AtRiskPanel from '../components/AtRiskPanel';
import AnomalyToastContainer from '../components/AnomalyToast';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAnomalyAlerts } from '../hooks/useAnomalyAlerts';
import api, { dashboardAPI, nfcAPI } from '../services/api';
import '../styles/Dashboard.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { startDashboardTour } from '../utils/dashboardTour';
import {
  formatTime,
  formatScheduleTime,
  isSchedulePast,
  isScheduleOngoing,
  getNotificationStatus,
  getOutNotificationStatus,
  getPageNumbers as computePageNumbers,
} from '../utils/dashboardFormatters';

/**
 * Get the WebSocket token from sessionStorage for WebSocket authentication.
 */
function getSessionToken() {
  return sessionStorage.getItem('ws_token') || '';
}

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, presentStudents: 0, presentVisitors: 0, enrolledToday: 0 });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginSuccessToast, setShowLoginSuccessToast] = useState(false);

  // Date range filter - default to today
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Type & course filters
  const [filterType, setFilterType]     = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Trend graph state
  const [trendData, setTrendData] = useState([]);
  const [trendFilter, setTrendFilter] = useState('All');
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(null);

  // Absent students state
  const [absentData, setAbsentData] = useState({ absent_students: [], total_expected: 0, total_absent: 0 });
  const [absentLoading, setAbsentLoading] = useState(true);

  // Today's schedules state
  const [schedulesToday, setSchedulesToday] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);

  // --- Real-time WebSocket integration ---
  const sessionToken = getSessionToken();
  const { connectionState, lastMessage, retryConnection } = useWebSocket(sessionToken);
  const { alerts, addAlert, dismissAlert } = useAnomalyAlerts(lastMessage);

  // Anomaly engine availability state
  const [engineAvailable, setEngineAvailable] = useState(true);

  // Manual batch analysis state
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchNotification, setBatchNotification] = useState({ isOpen: false, message: '', type: 'success' });

  // Toast alerts queue (new alerts shown as toasts then cleared)
  const [toastAlerts, setToastAlerts] = useState([]);

  // Handle attendance_event messages — prepend to logs, update presence, remove from absent
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'attendance_event') return;
    const event = lastMessage.data;
    if (!event) return;

    // Update attendance logs in real time.
    // - check_in: prepend a new row.
    // - check_out: find and update the existing open row for this student;
    //   only prepend a new row if no open row exists (e.g. the check-in
    //   happened before this dashboard session started).
    setAttendanceLogs(prev => {
      const timeStr = event.timestamp?.split('T')[1]?.substring(0, 8) || '';

      if (event.action === 'check_out') {
        // Find the most recent open row for this student (time_out empty/null)
        const openIdx = prev.findIndex(
          l => l.student_id === event.student_id &&
               l.row_type === 'student' &&
               !l.time_out
        );
        if (openIdx !== -1) {
          // Update the existing row in place
          const updated = [...prev];
          updated[openIdx] = { ...updated[openIdx], time_out: timeStr };
          return updated;
        }
        // No open row found — fall through to prepend a standalone row
        const fallbackRow = {
          attendance_id: `rt-${Date.now()}`,
          row_type: 'student',
          student_id: event.student_id,
          student_name: event.student_name,
          student_course: event.course || '',
          time_in: '',
          time_out: timeStr,
          attendance_flag: event.attendance_flag,
          msg_channel: null,
          msg_success: null,
          msg_out_channel: null,
          msg_out_success: null,
        };
        return [fallbackRow, ...prev];
      }

      // check_in — prepend a new row
      const newLog = {
        attendance_id: `rt-${Date.now()}`,
        row_type: 'student',
        student_id: event.student_id,
        student_name: event.student_name,
        student_course: event.course || '',
        time_in: timeStr,
        time_out: '',
        attendance_flag: event.attendance_flag,
        msg_channel: null,
        msg_success: null,
        msg_out_channel: null,
        msg_out_success: null,
      };
      return [newLog, ...prev];
    });

    // Update presence count
    setStats(prev => {
      const presentStudents = event.action === 'check_in'
        ? prev.presentStudents + 1
        : Math.max(0, prev.presentStudents - 1);
      return { ...prev, presentStudents };
    });

    // Remove from absent list if check_in
    if (event.action === 'check_in') {
      setAbsentData(prev => {
        const updatedAbsent = prev.absent_students.filter(
          s => s.student_id !== event.student_id
        );
        return {
          ...prev,
          absent_students: updatedAbsent,
          total_absent: updatedAbsent.length,
        };
      });
    }
  }, [lastMessage]);

  // Handle anomaly_alert messages — add toast notifications
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'anomaly_alert') return;
    const alertData = lastMessage.data;
    if (!alertData) return;

    setToastAlerts(prev => [alertData, ...prev]);
  }, [lastMessage]);

  // Handle engine_status messages
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'engine_status') return;
    setEngineAvailable(lastMessage.data?.available ?? true);
  }, [lastMessage]);

  const handleToastDismiss = useCallback((idx) => {
    setToastAlerts(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Pull today's already-detected alerts from the DB and feed them into the
  // At-Risk panel through addAlert (dedup/sort-safe). Shared by the on-mount
  // hydration and the post-analysis refresh so the panel updates without a
  // manual page reload. Returns the number of alerts received (for callers
  // that want to know whether anything came back).
  const hydrateAtRisk = useCallback(async () => {
    try {
      const response = await api.get('/anomaly/alerts-today.php');
      const todays = response.data?.alerts;
      if (response.data?.success && Array.isArray(todays)) {
        todays.forEach((alert) => addAlert(alert));
        return todays.length;
      }
    } catch (err) {
      // Non-fatal: the panel still fills from live broadcasts. Log for
      // diagnostics but don't surface a UI error for a background hydrate.
      console.warn('At-Risk hydration failed:', err?.message || err);
    }
    return 0;
  }, [addAlert]);

  // Trigger an on-demand batch analysis of all active students against the
  // attendance data already in the database. Results are written to each
  // student's anomaly history (viewable on their record page). In the future
  // this same endpoint will be run automatically by a daily cron job.
  const handleRunAnalysis = useCallback(async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      const response = await api.post('/anomaly/analyze-batch.php', {});
      const data = response.data?.data ?? {};
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Batch analysis failed');
      }
      const created = data.alerts_created ?? 0;
      const analyzed = data.students_analyzed ?? 0;
      const skipped = data.duplicates_skipped ?? 0;
      const flagged = Array.isArray(data.flagged_students) ? data.flagged_students : [];

      // Build a readable list of who was flagged so the admin doesn't have to
      // open each record to find them. Cap the names shown to keep the toast
      // compact; summarize the remainder as "+N more".
      const MAX_NAMES = 5;
      const names = flagged
        .map((s) => s?.student_name)
        .filter((n) => typeof n === 'string' && n.trim() !== '');
      const shownNames = names.slice(0, MAX_NAMES);
      const extraCount = names.length - shownNames.length;
      const nameList = shownNames.join(', ') +
        (extraCount > 0 ? `, +${extraCount} more` : '');

      const skippedSuffix = skipped > 0 ? ` (${skipped} already flagged today.)` : '';

      // Auto-refresh the At-Risk panel with the alerts just written by this
      // run, so the admin sees results immediately without a page reload.
      // addAlert dedupes, so re-feeding any already-shown alerts is harmless.
      await hydrateAtRisk();

      setBatchNotification({
        isOpen: true,
        type: 'success',
        message: created > 0
          ? (nameList
              ? `Analysis complete: ${created} alert(s) across ${analyzed} student(s). ` +
                `Flagged: ${nameList}.${skippedSuffix}`
              : `Analysis complete: ${created} alert(s) across ${analyzed} student(s). ` +
                `View details in each student's record.${skippedSuffix}`)
          : `Analysis complete: ${analyzed} student(s) checked, no new anomalies found.${skippedSuffix}`,
      });
    } catch (err) {
      console.error('Batch analysis error:', err);
      const msg = err?.response?.data?.message || err.message || 'Batch analysis failed';
      setBatchNotification({
        isOpen: true,
        type: 'error',
        message: `Could not run analysis: ${msg}`,
      });
    } finally {
      setBatchRunning(false);
    }
  }, [batchRunning, hydrateAtRisk]);

  // Live clock
  const [clock, setClock] = useState('');

  // Pagination helpers
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const indexOfFirstRecord = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexOfLastRecord = currentPage * ITEMS_PER_PAGE;

  const getPageNumbers = () => computePageNumbers(currentPage, totalPages);

  // Ensure scanner is in attendance mode whenever the dashboard is active.
  // This recovers from cases where VisitorPage left the mode as 'visitor'.
  useEffect(() => {
    nfcAPI.setMode('attendance').catch(() => {});
  }, []);

  // Load on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Hydrate the At-Risk panel on mount with today's already-detected alerts.
  // Without this the panel starts empty every page load and only fills from
  // live WebSocket broadcasts received *after* load, hiding anomalies that
  // were detected earlier today (e.g. by the morning batch run). Each alert is
  // pushed through addAlert so it flows through the same dedup/sort path as a
  // live broadcast — a later live alert for the same student+pattern is then
  // correctly suppressed as a duplicate.
  useEffect(() => {
    hydrateAtRisk();
  }, [hydrateAtRisk]);

  // Auto-refresh at midnight so dashboard resets to the new day
  useEffect(() => {
    const scheduleRefresh = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = midnight - now;

      return setTimeout(() => {
        loadDashboardData();
        // Schedule the next midnight refresh
        timerRef.current = scheduleRefresh();
      }, msUntilMidnight);
    };

    const timerRef = { current: scheduleRefresh() };
    return () => clearTimeout(timerRef.current);
  }, []);

  // Load trend data on mount
  useEffect(() => {
    const loadTrend = async () => {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const response = await dashboardAPI.getTrend();
        if (response.success && Array.isArray(response.data)) {
          setTrendData(response.data);
        } else {
          setTrendError('Failed to load trend data');
        }
      } catch (err) {
        setTrendError('Data unavailable');
      } finally {
        setTrendLoading(false);
      }
    };
    loadTrend();
  }, []);

  // Load absent students on mount
  useEffect(() => {
    const loadAbsent = async () => {
      setAbsentLoading(true);
      try {
        const response = await dashboardAPI.getAbsentToday();
        if (response.success) {
          setAbsentData(response.data);
        }
      } catch (err) {
        console.error('Failed to load absent data:', err);
      } finally {
        setAbsentLoading(false);
      }
    };
    loadAbsent();
  }, []);

  // Load today's schedules on mount
  useEffect(() => {
    const loadSchedules = async () => {
      setSchedulesLoading(true);
      try {
        const response = await dashboardAPI.getSchedulesToday();
        if (response.success && Array.isArray(response.data)) {
          setSchedulesToday(response.data);
        }
      } catch (err) {
        console.error('Failed to load schedules:', err);
      } finally {
        setSchedulesLoading(false);
      }
    };
    loadSchedules();
  }, []);

  // Listen for visitor check-in event (from VisitorPage)
  useEffect(() => {
    const handler = () => {
      loadDashboardData();
    };
    window.addEventListener('storage', (e) => {
      if (e.key === 'visitorCheckin') handler();
    });
    return () => {
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Apply filters whenever logs or filter state changes
  useEffect(() => {
    applyFilters(attendanceLogs);
  }, [attendanceLogs, filterType, filterCourse]);

  // Reset to first page whenever the filtered set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLogs.length]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const statsResponse = await api.get('/dashboard/stats.php');
      if (statsResponse.data?.success) setStats(statsResponse.data.data);

      // Compute today's date fresh each call so it stays correct after midnight
      const currentToday = new Date().toISOString().split('T')[0];
      const params = { date_from: currentToday, date_to: currentToday };

      const logsResponse = await api.get('/dashboard/logs.php', { params });

      const logs = logsResponse.data?.success && Array.isArray(logsResponse.data.data)
        ? logsResponse.data.data : [];
      setAttendanceLogs(logs);
    } catch (error) {
      console.error('Dashboard error:', error);
      setAttendanceLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = (logs) => {
    let result = [...logs];

    if (filterType === 'Student') {
      result = result.filter(l => l.row_type === 'student');
    } else if (filterType === 'Visitor') {
      result = result.filter(l => l.row_type === 'visitor');
    }

    if (filterCourse !== 'All' && filterType !== 'Visitor') {
      result = result.filter(l => l.student_course === filterCourse);
    }

    setFilteredLogs(result);
  };

  const handleFilter = () => loadDashboardData();

  const handleExport = async () => {
    try {
      const params = {
        type: filterType,
        course: filterCourse,
      };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await api.get('/dashboard/export.php', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fromLabel = dateFrom || 'all';
      const toLabel = dateTo || 'latest';
      link.download = `attendance_${fromLabel}_to_${toLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  // Guided onboarding tour (implementation extracted to utils/dashboardTour.js).
  const startTour = () => startDashboardTour();

  useEffect(() => {
    if (location.state?.justLoggedIn) {
      setShowLoginSuccessToast(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <AdminLayout className="dashboard-layout" connectionState={connectionState} onRetryConnection={retryConnection}>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
          </div>
          <button
            className="run-analysis-btn"
            onClick={handleRunAnalysis}
            disabled={batchRunning}
            title="Analyze all active students against existing attendance data"
          >
            {batchRunning ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Analyzing...
              </>
            ) : (
              <>
                <i className="fas fa-magnifying-glass-chart"></i>
                Run Anomaly Analysis
              </>
            )}
          </button>
        </div>

        {/* Two-column dashboard layout */}
        <div className="dashboard-columns">
          {/* Left column: Stats + Trend Graph */}
          <div className="dashboard-col-left">
            {/* Stats */}
            <div className="stats-grid">
              {[
                { label: 'Total Students', value: stats.totalStudents },
                { label: 'Students Present', value: stats.presentStudents },
                { label: 'Visitors Present', value: stats.presentVisitors },
              ].map((s) => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Visit Trend Graph */}
            <VisitTrendGraph
              data={trendData}
              filter={trendFilter}
              onFilterChange={setTrendFilter}
              isLoading={trendLoading}
              error={trendError}
            />

            {/* Compact Info Panels */}
            <div className="compact-panels">
              {/* Absent Students */}
              <div className="compact-panel">
                <div className="compact-panel-title">
                  <i className="fas fa-user-clock"></i>
                  <span>Expected But Absent</span>
                  {!absentLoading && (
                    <span className="compact-badge absent-badge">{absentData.total_absent}</span>
                  )}
                </div>
                <div className="compact-panel-content">
                  {absentLoading ? (
                    <span className="compact-loading">Loading...</span>
                  ) : absentData.absent_students.length === 0 ? (
                    <span className="compact-empty">
                      {absentData.total_expected > 0 ? 'All present ✓' : 'No classes today'}
                    </span>
                  ) : (
                    <div className="compact-tags">
                      {absentData.absent_students.slice(0, 8).map((student) => (
                        <span key={student.student_id} className="compact-tag absent-tag">
                          {student.student_name}
                        </span>
                      ))}
                      {absentData.absent_students.length > 8 && (
                        <span className="compact-tag more-tag">+{absentData.absent_students.length - 8} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Schedules */}
              <div className="compact-panel">
                <div className="compact-panel-title">
                  <i className="fas fa-calendar-day"></i>
                  <span>Today's Schedules</span>
                  {!schedulesLoading && (
                    <span className="compact-badge schedule-badge">{schedulesToday.length}</span>
                  )}
                </div>
                <div className="compact-panel-content">
                  {schedulesLoading ? (
                    <span className="compact-loading">Loading...</span>
                  ) : schedulesToday.length === 0 ? (
                    <span className="compact-empty">No classes today</span>
                  ) : (
                    <div className="compact-tags">
                      {schedulesToday.map((sched) => (
                        <span
                          key={sched.schedule_id}
                          className={`compact-tag schedule-tag ${isScheduleOngoing(sched.start_time, sched.end_time) ? 'tag-live' : ''} ${isSchedulePast(sched.end_time) ? 'tag-past' : ''}`}
                        >
                          {sched.course_name}
                          <span className="tag-time">{formatScheduleTime(sched.start_time)}</span>
                          {isScheduleOngoing(sched.start_time, sched.end_time) && <span className="tag-live-dot"></span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Engine Unavailable Indicator */}
            {!engineAvailable && (
              <div className="engine-unavailable-indicator" role="alert">
                <i className="fas fa-exclamation-circle"></i>
                <span>Anomaly detection is temporarily unavailable</span>
              </div>
            )}

            {/* At-Risk Students Panel */}
            <AtRiskPanel alerts={alerts} />
          </div>

          {/* Right column: Attendance Logs */}
          <div className="dashboard-col-right">
            <div className="logs-section">
              <div className="logs-header">
                <span>Attendance Logs</span>
              </div>

              <div className="logs-body">
                {isLoading ? (
                  <div className="empty-state">
                    <div className="spinner"></div>
                    <p>Loading attendance logs...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-users empty-people-icon"></i>
                    <p>No records yet</p>
                  </div>
                ) : (
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>SMS</th>
                        <th>Out</th>
                        <th>SMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((log) => (
                        <tr key={`${log.row_type}-${log.attendance_id}`}>
                          <td>
                            <div className="log-name-cell">
                              <span className={`log-type-indicator ${log.row_type === 'visitor' ? 'type-visitor' : 'type-student'}`}></span>
                              {log.student_name || 'Unknown'}
                            </div>
                          </td>
                          <td>{formatTime(log.time_in)}</td>
                          <td>
                            <span className={`sms-dot ${
                              log.row_type === 'visitor' ? 'dot-na' :
                              getNotificationStatus(log) === 'SMS' ? 'dot-sent' :
                              getNotificationStatus(log) === 'FAILED' ? 'dot-failed' : 'dot-na'
                            }`}>
                              {log.row_type === 'visitor' ? 'N/A' :
                                getNotificationStatus(log) === 'SMS' ? 'Sent' :
                                getNotificationStatus(log) === 'FAILED' ? 'Failed' : 'N/A'}
                            </span>
                          </td>
                          <td>{formatTime(log.time_out)}</td>
                          <td>
                            <span className={`sms-dot ${
                              log.row_type === 'visitor' ? 'dot-na' :
                              getOutNotificationStatus(log) === null ? 'dot-na' :
                              getOutNotificationStatus(log) === 'SMS' ? 'dot-sent' :
                              getOutNotificationStatus(log) === 'FAILED' ? 'dot-failed' : 'dot-na'
                            }`}>
                              {log.row_type === 'visitor' ? 'N/A' :
                                getOutNotificationStatus(log) === null ? '---' :
                                getOutNotificationStatus(log) === 'SMS' ? 'Sent' :
                                getOutNotificationStatus(log) === 'FAILED' ? 'Failed' : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {filteredLogs.length > ITEMS_PER_PAGE && (
                <div className="pagination">
                  <span className="pagination-info">
                    Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredLogs.length)} of {filteredLogs.length}
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    {getPageNumbers().map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                      ) : (
                        <button
                          key={page}
                          className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Floating Help Button */}
      <button className="help-float-btn" onClick={startTour}>
        <i className="fas fa-question"></i>
      </button>

      <Notification
        isOpen={showLoginSuccessToast}
        onClose={() => setShowLoginSuccessToast(false)}
        message="Login successful. Welcome to the Admin Dashboard!"
        type="success"
      />

      <Notification
        isOpen={batchNotification.isOpen}
        onClose={() => setBatchNotification({ ...batchNotification, isOpen: false })}
        message={batchNotification.message}
        type={batchNotification.type}
      />

      {/* Real-time anomaly toast notifications */}
      <AnomalyToastContainer alerts={toastAlerts} onDismiss={handleToastDismiss} />
    </AdminLayout>
  );
}

export default Dashboard;