import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import { studentsAPI, attendanceAPI } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard() {
  // State management
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

  // Load initial data
  useEffect(() => {
    loadStatistics();
    loadAttendanceLogs();
  }, []);

  // Start polling for new attendance
  useEffect(() => {
    const interval = setInterval(() => {
      checkNewAttendance();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [lastCheckTimestamp]);

  // Reload logs when date filter changes
  useEffect(() => {
    loadAttendanceLogs();
  }, [filterDate]);

  // Load statistics
  const loadStatistics = async () => {
    try {
      // Get total enrollees
      const studentsResponse = await studentsAPI.list();
      if (studentsResponse.success) {
        setStats(prev => ({
          ...prev,
          totalEnrollees: studentsResponse.data.length
        }));

        // Count newcomers (enrolled today) - if you have created_at field
        const today = new Date().toISOString().split('T')[0];
        const newcomers = studentsResponse.data.filter(student => 
          student.created_at && student.created_at.startsWith(today)
        );
        setStats(prev => ({
          ...prev,
          newcomersCount: newcomers.length
        }));
      }

      // Get present count
      const attendanceResponse = await attendanceAPI.list({ 
        date: new Date().toISOString().split('T')[0] 
      });
      if (attendanceResponse.success) {
        const present = attendanceResponse.data.filter(log => log.time_in && !log.time_out);
        setStats(prev => ({
          ...prev,
          presentCount: present.length
        }));
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Load attendance logs
  const loadAttendanceLogs = async () => {
    setIsLoading(true);
    try {
      const response = await attendanceAPI.list({ date: filterDate });
      if (response.success) {
        setAttendanceLogs(response.data);
      }
    } catch (error) {
      console.error('Error loading attendance logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for new attendance
  const checkNewAttendance = async () => {
    try {
      const response = await attendanceAPI.recent(lastCheckTimestamp);
      if (response.success && response.data.logs && response.data.logs.length > 0) {
        // Show notification for the most recent log
        const latestLog = response.data.logs[0];
        setNotification({
          isOpen: true,
          studentName: latestLog.student_name,
          action: latestLog.action
        });

        // Update timestamp
        setLastCheckTimestamp(response.data.timestamp);

        // Refresh logs and statistics
        loadAttendanceLogs();
        loadStatistics();

        // Play sound (optional)
        playNotificationSound();
      }
    } catch (error) {
      console.error('Error checking new attendance:', error);
    }
  };

  // Play notification sound
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

      {/* Modals and Notifications */}
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
