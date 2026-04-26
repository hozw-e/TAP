import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import axios from 'axios';
import '../styles/Dashboard.css';

// CACHE BREAKER VERSION 2.0
const API_STATS_URL = 'http://localhost/apdc/backend/api/dashboard/stats.php';
const API_LOGS_URL = 'http://localhost/apdc/backend/api/dashboard/logs.php';
const API_EXPORT_URL = 'http://localhost/apdc/backend/api/dashboard/export.php';

function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    enrolledToday: 0
  });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      console.log('[DASHBOARD V2] Loading stats from:', API_STATS_URL);
      const statsResponse = await axios.get(API_STATS_URL);
      console.log('[DASHBOARD V2] Stats response:', statsResponse.data);
      
      if (statsResponse.data && statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      console.log('[DASHBOARD V2] Loading logs from:', API_LOGS_URL, 'with date:', selectedDate);
      const logsResponse = await axios({
        method: 'GET',
        url: API_LOGS_URL,
        params: { date: selectedDate }
      });
      console.log('[DASHBOARD V2] Logs response:', logsResponse.data);
      
      if (logsResponse.data && logsResponse.data.success) {
        setAttendanceLogs(Array.isArray(logsResponse.data.data) ? logsResponse.data.data : []);
      } else {
        setAttendanceLogs([]);
      }
    } catch (error) {
      console.error('[DASHBOARD V2] Error:', error);
      setAttendanceLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    console.log('[DASHBOARD V2] Refresh clicked');
    loadDashboardData();
  };

  const handleDateChange = (e) => {
    console.log('[DASHBOARD V2] Date changed to:', e.target.value);
    setSelectedDate(e.target.value);
  };

  const handleExport = () => {
    window.open(`${API_EXPORT_URL}?date=${selectedDate}`, '_blank');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '---';
    try {
      // timeStr is "HH:MM:SS" from DB — parse manually to avoid timezone issues
      const [hoursStr, minutesStr] = timeStr.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (isNaN(hours) || isNaN(minutes)) return '---';
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const minuteStr = String(minutes).padStart(2, '0');
      return `${hour12}:${minuteStr} ${ampm}`;
    } catch (e) {
      return '---';
    }
  };

  const calculateDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '---';
    try {
      // Parse "HH:MM:SS" manually into total seconds
      const toSeconds = (t) => {
        const [h, m, s] = t.split(':').map(Number);
        return h * 3600 + m * 60 + (s || 0);
      };
      const diffSecs = toSeconds(timeOut) - toSeconds(timeIn);
      if (diffSecs < 0) return '---';
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      return `${hours} hrs ${minutes} mins`;
    } catch (e) {
      return '---';
    }
  };

  const getSMSStatus = (log) => {
    return (log.sms_sent === true || log.sms_sent === 1) ? 'SENT' : 'FAILED TO SEND';
  };

  const getStatus = (log) => {
    return (log.time_out && log.time_out !== null) ? 'LEFT' : 'PRESENT';
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p className="page-subtitle">Welcome back, Admin!</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-header">Enrollees</div>
            <div className="stat-card-body">
              <div className="stat-card-value">{stats.totalStudents}</div>
              <div className="stat-card-label">Total Students</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">Present</div>
            <div className="stat-card-body">
              <div className="stat-card-value">{stats.presentToday}</div>
              <div className="stat-card-label">Currently In Facility</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">Newcomers</div>
            <div className="stat-card-body">
              <div className="stat-card-value">{stats.enrolledToday}</div>
              <div className="stat-card-label">Enrolled Today</div>
            </div>
          </div>
        </div>
        <div className="logs-section">
          <div className="logs-header">
            <span>Attendance Logs</span>
            <div className="logs-controls">
              <input type="date" className="date-picker" value={selectedDate} onChange={handleDateChange} />
              <button className="refresh-btn" onClick={handleRefresh}>
                <i className="fas fa-sync-alt"></i>
                Refresh
              </button>
            </div>
          </div>
          <div className="logs-body">
            {isLoading ? (
              <div className="empty-state">
                <div className="spinner"></div>
                <p>Loading attendance logs...</p>
              </div>
            ) : attendanceLogs.length === 0 ? (
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
                  {attendanceLogs.map((log) => (
                    <tr key={log.attendance_id}>
                      <td>{log.student_name || 'Unknown'}</td>
                      <td>{formatTime(log.time_in)}</td>
                      <td>{formatTime(log.time_out)}</td>
                      <td>{calculateDuration(log.time_in, log.time_out)}</td>
                      <td>
                        <span className={`sms-badge ${getSMSStatus(log) === 'SENT' ? 'sms-sent' : 'sms-failed'}`}>
                          {getSMSStatus(log)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatus(log) === 'PRESENT' ? 'status-present' : 'status-left'}`}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="export-btn" onClick={handleExport}>
            <i className="fas fa-file-pdf"></i> Export PDF
          </button>
        </div>
      </div>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </div>
  );
}

export default Dashboard;