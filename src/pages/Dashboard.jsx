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
import introJs from 'intro.js';
import 'intro.js/introjs.css';

/**
 * Get session token from sessionStorage for WebSocket authentication.
 */
function getSessionToken() {
  return sessionStorage.getItem('session_token') || '';
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
  const { alerts, dismissAlert } = useAnomalyAlerts(lastMessage);

  // Anomaly engine availability state
  const [engineAvailable, setEngineAvailable] = useState(true);

  // Toast alerts queue (new alerts shown as toasts then cleared)
  const [toastAlerts, setToastAlerts] = useState([]);

  // Handle attendance_event messages — prepend to logs, update presence, remove from absent
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'attendance_event') return;
    const event = lastMessage.data;
    if (!event) return;

    // Prepend to attendance logs (maintain max page consistency)
    setAttendanceLogs(prev => {
      const newLog = {
        attendance_id: `rt-${Date.now()}`,
        row_type: 'student',
        student_id: event.student_id,
        student_name: event.student_name,
        student_course: event.course || '',
        time_in: event.action === 'check_in' ? event.timestamp?.split('T')[1]?.substring(0, 8) || '' : '',
        time_out: event.action === 'check_out' ? event.timestamp?.split('T')[1]?.substring(0, 8) || '' : '',
        attendance_flag: event.attendance_flag,
        msg_channel: null,
        msg_success: null,
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

  // Live clock
  const [clock, setClock] = useState('');

  // Pagination helpers
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const indexOfFirstRecord = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexOfLastRecord = currentPage * ITEMS_PER_PAGE;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Ensure scanner is in attendance mode whenever the dashboard is active.
  // This recovers from cases where VisitorPage left the mode as 'visitor'.
  useEffect(() => {
    nfcAPI.setMode('attendance').catch(() => {});
  }, []);

  // Load on mount
  useEffect(() => {
    loadDashboardData();
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

      // Always fetch today's logs for the dashboard
      const params = { date_from: today, date_to: today };

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

  const startTour = () => {
    const intro = introJs();
    
    const buildIntro = (step, total, description) => {
      return `<div class="tour-card">
        <div class="tour-header">
          <span class="tour-title">${description.split('|')[0]}</span>
          <span class="tour-step">${step} of ${total}</span>
        </div>
        <div class="tour-body">${description.split('|')[1]}</div>
        <div class="tour-skip"><a href="javascript:void(0)" class="tour-skip-btn" onclick="document.querySelector('.introjs-skipbutton')?.click()">Skip Tour</a></div>
      </div>`;
    };

    const totalSteps = 14;

    intro.setOptions({
      steps: [
        { intro: buildIntro(1, totalSteps, 'Welcome to Dashboard!|This is your main control center for monitoring attendance and system activity. Let me show you around!') },
        { element: '.dashboard-col-left', intro: buildIntro(2, totalSteps, 'Overview Panel|The left side shows your key statistics, attendance trends, and quick-glance info panels.') },
        { element: '.stats-grid', intro: buildIntro(3, totalSteps, 'Statistics Cards|These cards give you a quick snapshot of your facility\'s current status.') },
        { element: '.stat-card:nth-child(1)', intro: buildIntro(4, totalSteps, 'Total Students|Shows the total number of students registered in the system.') },
        { element: '.stat-card:nth-child(2)', intro: buildIntro(5, totalSteps, 'Students Present|Displays how many students are currently inside the facility right now.') },
        { element: '.stat-card:nth-child(3)', intro: buildIntro(6, totalSteps, 'Visitors Present|Shows the number of visitors currently checked in at the facility.') },
        { element: '.visit-trend-container', intro: buildIntro(7, totalSteps, 'Visit Trend Graph|Visualizes attendance patterns over time. Use the filter to view All, Students only, or Visitors only.') },
        { element: '.compact-panels', intro: buildIntro(8, totalSteps, 'Info Panels|These panels show today\'s absent students and scheduled classes so you can quickly see who\'s missing and what\'s coming up.') },
        { element: '.compact-panel:nth-child(1)', intro: buildIntro(9, totalSteps, 'Expected But Absent|Lists students who have a scheduled class today but haven\'t checked in yet. Helps you track attendance gaps in real time.') },
        { element: '.compact-panel:nth-child(2)', intro: buildIntro(10, totalSteps, 'Today\'s Schedules|Shows all courses scheduled for today with their start times. Live classes are highlighted with a pulsing dot, and past classes are dimmed.') },
        { element: '.logs-section', intro: buildIntro(11, totalSteps, 'Attendance Logs|Today\'s attendance records showing Name, Time In, SMS notification status, Time Out, and Out SMS status.') },
        { element: '.logs-table', intro: buildIntro(12, totalSteps, 'Logs Table|Each row shows a student or visitor entry. The colored dot indicates student (purple) or visitor (blue). SMS columns show notification status for check-in and check-out.') },
        { element: '.sidebar', intro: buildIntro(13, totalSteps, 'Navigation Menu|Use the sidebar to navigate to Student Records, Attendance Logs, Visitor Logs, Activity Logs, Course Schedules, and the Login Panel.') },
        { element: '.help-float-btn', intro: buildIntro(14, totalSteps, 'Help Button|Click this button anytime to restart this tour and review the dashboard features. That\'s it! You\'re all set!') }
      ],
      showProgress: false,
      showBullets: false,
      showStepNumbers: false,
      exitOnOverlayClick: false,
      doneLabel: 'Done',
      nextLabel: 'Next',
      prevLabel: 'Back',
      skipLabel: 'Skip Tour',
      allowHtml: true,
      tooltipClass: 'custom-tour-tooltip'
    });
    
    intro.start();
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '---';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return '---';
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch { return '---'; }
  };

  const formatScheduleTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const isSchedulePast = (endTime) => {
    if (!endTime) return false;
    const now = new Date();
    const [h, m] = endTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(h, m, 0, 0);
    return now > endDate;
  };

  const isScheduleOngoing = (startTime, endTime) => {
    if (!startTime || !endTime) return false;
    const now = new Date();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = new Date();
    start.setHours(sh, sm, 0, 0);
    const end = new Date();
    end.setHours(eh, em, 0, 0);
    return now >= start && now <= end;
  };

  const calculateDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '---';
    try {
      const toSec = t => { const [h,m,s] = t.split(':').map(Number); return h*3600+m*60+(s||0); };
      const diff = toSec(timeOut) - toSec(timeIn);
      if (diff < 0) return '---';
      return `${Math.floor(diff/3600)} hrs ${Math.floor((diff%3600)/60)} mins`;
    } catch { return '---'; }
  };

  const getNotificationStatus = (log) => {
    if (log.row_type === 'visitor') return 'N/A';
    if (log.msg_channel && log.msg_success) {
      return 'SMS';
    }
    if (log.msg_success === 0 || log.msg_success === false) {
      return 'FAILED';
    }
    return 'N/A';
  };

  const getStatus = (log) => {
    if (log.row_type === 'visitor') return 'VISITOR';
    if (log.auto_closed) return 'NO TIME OUT';
    if (!log.time_out) {
      const today = new Date().toISOString().split('T')[0];
      if (log.date && log.date < today) return 'NO TIME OUT';
      return 'PRESENT';
    }
    return 'LEFT';
  };

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
                              !log.time_out ? 'dot-na' :
                              log.msg_out_success ? 'dot-sent' :
                              log.msg_out_success === 0 ? 'dot-failed' : 'dot-na'
                            }`}>
                              {log.row_type === 'visitor' ? 'N/A' :
                                !log.time_out ? '---' :
                                log.msg_out_success ? 'Sent' :
                                log.msg_out_success === 0 ? 'Failed' : 'N/A'}
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

      {/* Real-time anomaly toast notifications */}
      <AnomalyToastContainer alerts={toastAlerts} onDismiss={handleToastDismiss} />
    </AdminLayout>
  );
}

export default Dashboard;