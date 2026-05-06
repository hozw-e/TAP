import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import axios from 'axios';
import '../styles/Dashboard.css';
import TopBar from '../components/TopBar';
import { useLocation, useNavigate } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_BASE_URL;
const API_STATS_URL = `${BASE}/dashboard/stats.php`;
const API_LOGS_URL  = `${BASE}/dashboard/logs.php`;
const API_EXPORT_URL = `${BASE}/dashboard/export.php`;

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, enrolledToday: 0 });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginSuccessToast, setShowLoginSuccessToast] = useState(false);

  // Date range filter
  const todayStr = () => new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo]     = useState(todayStr());

  // Type & course filters
  const [filterType, setFilterType]     = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');

  // Live clock
  const [clock, setClock] = useState('');

  // Load on mount
  useEffect(() => {
    loadDashboardData();
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

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const statsResponse = await axios.get(API_STATS_URL);
      if (statsResponse.data?.success) setStats(statsResponse.data.data);

      const logsResponse = await axios.get(API_LOGS_URL, {
        params: { date_from: dateFrom, date_to: dateTo }
      });

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

  const handleExport = () => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      type: filterType,
      course: filterCourse,
      _t: String(Date.now()),
    });
    window.open(`${API_EXPORT_URL}?${params.toString()}`, '_blank');
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

  const calculateDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '---';
    try {
      const toSec = t => { const [h,m,s] = t.split(':').map(Number); return h*3600+m*60+(s||0); };
      const diff = toSec(timeOut) - toSec(timeIn);
      if (diff < 0) return '---';
      return `${Math.floor(diff/3600)} hrs ${Math.floor((diff%3600)/60)} mins`;
    } catch { return '---'; }
  };

  const getSMSStatus = (log) => {
    if (log.row_type === 'visitor') return 'N/A';
    return (log.sms_sent === true || log.sms_sent === 1) ? 'SENT' : 'FAILED TO SEND';
  };

  const getStatus = (log) => {
    if (log.row_type === 'visitor') return 'VISITOR';
    return log.time_out ? 'LEFT' : 'PRESENT';
  };

  useEffect(() => {
    if (location.state?.justLoggedIn) {
      setShowLoginSuccessToast(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">

        <TopBar />

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Enrollees', value: stats.totalStudents, sub: 'Total Students' },
            { label: 'Present', value: stats.presentToday, sub: 'Currently In Facility' },
            { label: 'Newcomers', value: stats.enrolledToday, sub: 'Enrolled Today' },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-header">{s.label}</div>
              <div className="stat-card-body">
                <div className="stat-card-value">{s.value}</div>
                <div className="stat-card-label">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance Logs */}
        <div className="logs-section">
          <div className="logs-header">
            <span>Attendance Logs</span>
            <div className="logs-controls">
              <label className="filter-label">From</label>
              <input type="date" className="date-picker" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <label className="filter-label">To</label>
              <input type="date" className="date-picker" value={dateTo} onChange={e => setDateTo(e.target.value)} />

              {/* Type filter */}
              <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="All">All Types</option>
                <option value="Student">Student</option>
                <option value="Visitor">Visitor</option>
              </select>

              {/* Course filter */}
              <select
                className="filter-select"
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
                disabled={filterType === 'Visitor'}
              >
                <option value="All">All Courses</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button className="refresh-btn" onClick={handleFilter}>
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>

          <div className="logs-body">
            {isLoading ? (
              <div className="empty-state">
                <div className="spinner"></div>
                <p>Loading attendance logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard-list"></i>
                <p>No attendance logs for this date</p>
              </div>
            ) : (
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Duration</th>
                    <th>SMS Notification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={`${log.row_type}-${log.attendance_id}`}>
                      <td>{log.student_name || 'Unknown'}</td>
                      <td>{formatTime(log.time_in)}</td>
                      <td>{log.row_type === 'visitor' ? 'N/A' : formatTime(log.time_out)}</td>
                      <td>{log.row_type === 'visitor' ? 'N/A' : calculateDuration(log.time_in, log.time_out)}</td>
                      <td>
                        <span className={`sms-badge ${log.row_type === 'visitor' ? 'sms-na' : getSMSStatus(log) === 'SENT' ? 'sms-sent' : 'sms-failed'}`}>
                          {getSMSStatus(log)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${log.row_type === 'visitor' ? 'status-visitor' : getStatus(log) === 'PRESENT' ? 'status-present' : 'status-left'}`}>
                          {getStatus(log)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="bottom-row">
          <button className="export-btn" onClick={handleExport}>
            <i className="fas fa-file-pdf"></i> Export PDF
          </button>
        </div>

      </div>

      {/* Floating Help Button */}
      <button className="help-float-btn" onClick={() => setShowHelpModal(true)}>
        <i className="fas fa-question"></i>
      </button>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-overlay show" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal-content" onClick={e => e.stopPropagation()}>
            <div className="help-modal-header">
              <h2>Help</h2>
              <button className="modal-close-btn" onClick={() => setShowHelpModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="help-modal-body">
              <p>Help content coming soon.</p>
            </div>
          </div>
        </div>
      )}

      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} />

      <Notification
        isOpen={showLoginSuccessToast}
        onClose={() => setShowLoginSuccessToast(false)}
        message="Login successful. Welcome to the Admin Dashboard!"
        type="success"
      />
    </div>
  );
}

export default Dashboard;