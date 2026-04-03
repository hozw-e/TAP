import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import { studentsAPI, attendanceAPI } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    totalEnrollees: 0,
    presentCount: 0,
    newcomersCount: 0
  });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notification, setNotification] = useState({
    isOpen: false,
    studentName: '',
    action: ''
  });
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    loadStatistics();
    loadAttendanceLogs();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      checkNewAttendance();
    }, 3000);

    return () => clearInterval(interval);
  }, [lastCheckTimestamp]);

  useEffect(() => {
    loadAttendanceLogs();
  }, [filterDate]);

  const loadStatistics = async () => {
    try {
      const studentsResponse = await studentsAPI.list();

      // ✅ FIX: Safely extract array — handles flat array or nested under .data.data
      const studentsData = Array.isArray(studentsResponse?.data)
        ? studentsResponse.data
        : Array.isArray(studentsResponse?.data?.data)
          ? studentsResponse.data.data
          : [];

      if (studentsResponse?.success) {
        setStats(prev => ({
          ...prev,
          totalEnrollees: studentsData.length
        }));

        const today = new Date().toISOString().split('T')[0];

        // ✅ FIX: .filter() is now safe because studentsData is guaranteed to be an array
        const newcomers = studentsData.filter(student =>
          student.created_at && student.created_at.startsWith(today)
        );
        setStats(prev => ({
          ...prev,
          newcomersCount: newcomers.length
        }));
      }

      const attendanceResponse = await attendanceAPI.list({
        date: new Date().toISOString().split('T')[0]
      });

      // ✅ FIX: Same safe extraction for attendance data
      const attendanceData = Array.isArray(attendanceResponse?.data)
        ? attendanceResponse.data
        : Array.isArray(attendanceResponse?.data?.data)
          ? attendanceResponse.data.data
          : [];

      if (attendanceResponse?.success) {
        // ✅ FIX: .filter() is now safe
        const present = attendanceData.filter(log => log.time_in && !log.time_out);
        setStats(prev => ({
          ...prev,
          presentCount: present.length
        }));
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadAttendanceLogs = async () => {
    setIsLoading(true);
    try {
      const response = await attendanceAPI.list({ date: filterDate });

      // ✅ FIX: Safely extract array — never set state to a non-array
      const logsData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

      if (response?.success) {
        setAttendanceLogs(logsData);
      } else {
        setAttendanceLogs([]);
      }
    } catch (error) {
      console.error('Error loading attendance logs:', error);
      setAttendanceLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const checkNewAttendance = async () => {
    try {
      const response = await attendanceAPI.recent(lastCheckTimestamp);

      // ✅ FIX: Safely access nested logs array
      const logs = Array.isArray(response?.data?.logs) ? response.data.logs : [];

      if (response?.success && logs.length > 0) {
        const latestLog = logs[0];
        setNotification({
          isOpen: true,
          studentName: latestLog.student_name,
          action: latestLog.action
        });

        setLastCheckTimestamp(response.data.timestamp);

        loadAttendanceLogs();
        loadStatistics();
        playNotificationSound();
      }
    } catch (error) {
      console.error('Error checking new attendance:', error);
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=');
    audio.play().catch(e => console.log('Could not play sound'));
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />

      <div className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, Admin!</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-card-header">Enrollees</div>
            <div className="stat-card-body">
              <div className="stat-number">{stats.totalEnrollees}</div>
              <div className="stat-label">Total Students</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">Present</div>
            <div className="stat-card-body">
              <div className="stat-number">{stats.presentCount}</div>
              <div className="stat-label">Currently In Facility</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">Newcomers</div>
            <div className="stat-card-body">
              <div className="stat-number">{stats.newcomersCount}</div>
              <div className="stat-label">Enrolled Today</div>
            </div>
          </div>
        </div>

        {/* Attendance Logs */}
        <div className="logs-section">
          <div className="logs-header">
            <span>Attendance Logs</span>
            <div className="filter-controls">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              <button className="refresh-btn" onClick={loadAttendanceLogs}>
                <i className="fas fa-sync"></i> Refresh
              </button>
            </div>
          </div>

          <div className="logs-body">
            {isLoading ? (
              <div className="loading-spinner">
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
                    <th>Student Name</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLogs.map((log, index) => (
                    <tr key={index}>
                      <td>{log.student_name}</td>
                      <td>{log.time_in || '-'}</td>
                      <td>{log.time_out || '-'}</td>
                      <td>
                        <span className={`status-badge ${log.time_out ? 'status-out' : 'status-in'}`}>
                          {log.time_out ? 'OUT' : 'IN'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
      />

      <Notification
        isOpen={notification.isOpen}
        studentName={notification.studentName}
        action={notification.action}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}

export default Dashboard;