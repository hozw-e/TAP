import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import axios from 'axios';
import '../styles/Dashboard.css';
import TopBar from '../components/TopBar';
import { useLocation, useNavigate } from 'react-router-dom';
import introJs from 'intro.js';
import 'intro.js/introjs.css';

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
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginSuccessToast, setShowLoginSuccessToast] = useState(false);

  // Date range filter (empty = all records)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Type & course filters
  const [filterType, setFilterType]     = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');

  // Pagination
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

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

  // Reset to first page whenever the filtered set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLogs.length]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const statsResponse = await axios.get(API_STATS_URL);
      if (statsResponse.data?.success) setStats(statsResponse.data.data);

      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const logsResponse = await axios.get(API_LOGS_URL, { params });

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

    intro.setOptions({
      steps: [
        { intro: buildIntro(1, 17, 'Welcome to Dashboard!|This is your main control center for monitoring attendance and system activity. Let me show you around!') },
        { element: '.stats-grid', intro: buildIntro(2, 17, 'Statistics Overview|These cards give you a quick snapshot of your facility\'s current status at a glance.') },
        { element: '.stat-card:nth-child(1)', intro: buildIntro(3, 17, 'Total Enrollees|Shows the total number of students registered in the system.') },
        { element: '.stat-card:nth-child(2)', intro: buildIntro(4, 17, 'Present Students|Displays how many students are currently inside the facility right now.') },
        { element: '.stat-card:nth-child(3)', intro: buildIntro(5, 17, 'Newcomers Today|Shows the number of students who enrolled today.') },
        { element: '.logs-section', intro: buildIntro(6, 17, 'Attendance Logs|This section displays all attendance records including check-in/check-out times, duration, and SMS notifications.') },
        { element: '.date-picker:nth-of-type(1)', intro: buildIntro(7, 17, 'From Date|Select the start date to filter attendance logs. Default is today\'s date.') },
        { element: '.date-picker:nth-of-type(2)', intro: buildIntro(8, 17, 'To Date|Select the end date for your date range filter. Default is today\'s date.') },
        { element: '.filter-select:nth-of-type(1)', intro: buildIntro(9, 17, 'Type Filter|Filter records by type: view All records, only Students, or only Visitors.') },
        { element: '.filter-select:nth-of-type(2)', intro: buildIntro(10, 17, 'Course Filter|Filter students by their enrolled course. This is disabled when viewing Visitors.') },
        { element: '.refresh-btn', intro: buildIntro(11, 17, 'Search Button|Click here to apply your selected date range and filters to the attendance logs.') },
        { element: '.logs-table', intro: buildIntro(12, 17, 'Attendance Table|View detailed attendance information: Name, Time In, Time Out, Duration, SMS Notification status, and current Status.') },
        { element: '.sms-badge', intro: buildIntro(13, 17, 'SMS Notifications|Shows SMS status: SENT (blue) means guardian was notified, FAILED TO SEND (red) means notification failed, N/A (gray) for visitors.') },
        { element: '.status-badge', intro: buildIntro(14, 17, 'Status Indicators|PRESENT (green) = student is in facility, LEFT (orange) = student has checked out, VISITOR (blue) = visitor entry.') },
        { element: '.export-btn', intro: buildIntro(15, 17, 'Export PDF|Generate and download a PDF report of the filtered attendance data for your records.') },
        { element: '.sidebar', intro: buildIntro(16, 17, 'Navigation Menu|Use the sidebar to navigate to Students management, Activity Logs, and other sections of the system.') },
        { element: '.help-float-btn', intro: buildIntro(17, 17, 'Help Button|Click this button anytime to restart this tour and get help with the dashboard features. That\'s it! You\'re all set!') }
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
              <div className="stat-card-title">{s.label}</div>
              <div className="stat-card-figure">
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
                <p>No attendance logs for this date.</p>
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
                  {filteredLogs
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((log) => (
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

          {/* Pagination - bottom-right of the logs card */}
          {filteredLogs.length > ITEMS_PER_PAGE && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)} ({filteredLogs.length} total)
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(filteredLogs.length / ITEMS_PER_PAGE), p + 1)
                  )
                }
                disabled={currentPage === Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div className="bottom-row">
          <button className="export-btn" onClick={handleExport}>
            <i className="fas fa-file-pdf"></i> Export PDF
          </button>
        </div>

      </div>

      {/* Floating Help Button */}
      <button className="help-float-btn" onClick={startTour}>
        <i className="fas fa-question"></i>
      </button>

      {/* Help Modal - Removed, replaced with Intro.js tour */}

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