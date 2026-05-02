import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import { attendanceAPI, studentsAPI } from '../services/api';
import '../styles/Students.css';
import '../styles/ViewRecordModal.css';

function ViewRecord() {
  const { studentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [student, setStudent] = useState(location.state?.student || null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingStudent, setIsLoadingStudent] = useState(!location.state?.student);

  useEffect(() => {
    const loadStudent = async () => {
      if (student) return;
      setIsLoadingStudent(true);
      try {
        const response = await studentsAPI.list();
        const studentsData = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];
        const found = studentsData.find((item) => String(item.student_id) === String(studentId));
        setStudent(found || null);
      } catch (error) {
        console.error('Error loading student:', error);
        setStudent(null);
      } finally {
        setIsLoadingStudent(false);
      }
    };
    loadStudent();
  }, [student, studentId]);

  useEffect(() => {
    const loadAttendanceLogs = async () => {
      const targetStudentId = student?.student_id || studentId;
      if (!targetStudentId) return;
      setIsLoadingLogs(true);
      try {
        const response = await attendanceAPI.list({ student_id: targetStudentId });
        const logsData = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response?.data?.logs)
              ? response.data.logs
            : [];
        const normalizedLogs = logsData
          .map((log) => ({
            ...log,
            attendanceDate: log.date || log.log_date || log.date_created || log.created_at || null,
          }))
          .sort((a, b) => {
            const aDateTime = new Date(`${a.attendanceDate || ''} ${a.time_in || '00:00:00'}`).getTime();
            const bDateTime = new Date(`${b.attendanceDate || ''} ${b.time_in || '00:00:00'}`).getTime();
            return bDateTime - aDateTime;
          });

        setAttendanceLogs(normalizedLogs);
      } catch (error) {
        console.error('Error loading attendance logs:', error);
        setAttendanceLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadAttendanceLogs();
  }, [student, studentId]);

  const studentStatus = useMemo(() => {
    if (!attendanceLogs.length) return 'No Recent Logs';
    const latest = attendanceLogs[0];
    return latest?.time_out ? 'Inactive' : 'Active';
  }, [attendanceLogs]);

  const getLogStatus = (log) => {
    if (!log?.time_in) return 'Absent';
    if (log?.time_in && !log?.time_out) return 'Present';
    return 'Completed';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--';
    const normalized = timeString.length <= 5 ? `${timeString}:00` : timeString;
    const date = new Date(`1970-01-01T${normalized}`);
    if (Number.isNaN(date.getTime())) return timeString;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">
        {isLoadingStudent ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading student record...</p>
          </div>
        ) : !student ? (
          <div className="empty-state">
            <i className="fas fa-user-slash"></i>
            <p>Student record not found</p>
          </div>
        ) : (
          <div className="view-record-page-content">
            <div className="view-record-topbar">
              <button className="view-back-btn" onClick={() => navigate('/students')}>
                <i className="fas fa-chevron-left"></i> Back
              </button>
            </div>

            <div className="view-record-layout">
              <div className="view-left-panel">
                <div className="view-profile-card">
                  <h2>{student.student_name || 'Unknown Student'}</h2>
                  <p className="view-meta">NFC ID: {student.nfc_uid || 'XXXXXXX'}</p>
                  <div className="view-profile-stats">
                    <div>
                      <span className="label">Member since</span>
                      <strong>{formatDate(student.created_at || student.enrollment_date)}</strong>
                    </div>
                    <div>
                      <span className="label">Status</span>
                      <strong className={`status ${studentStatus.toLowerCase().replace(' ', '-')}`}>{studentStatus}</strong>
                    </div>
                  </div>
                </div>

                <div className="view-logs-card">
                  <div className="view-card-title">Attendance Logs</div>
                  {isLoadingLogs ? (
                    <p className="empty-log">Loading logs...</p>
                  ) : attendanceLogs.length === 0 ? (
                    <p className="empty-log">No attendance logs available.</p>
                  ) : (
                    <ul className="view-log-list">
                      {attendanceLogs.map((log, index) => {
                        const status = getLogStatus(log);
                        return (
                          <li key={`${log.attendance_id || 'log'}-${index}`}>
                            <span>{formatDate(log.attendanceDate)}</span>
                            <span className="log-time">{`${formatTime(log.time_in)} - ${log.time_out ? formatTime(log.time_out) : 'Active'}`}</span>
                            <span className={`log-badge ${status.toLowerCase()}`}>{status}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="view-main-panel">
                <div className="view-panel-header">
                  <h3>Student Information</h3>
                  <div className="view-actions">
                    <button className="view-action-btn edit" onClick={() => navigate(`/students/${student.student_id}/edit`, { state: { student } })}>
                      <i className="fas fa-pencil-alt"></i> Edit Profile
                    </button>
                    <button className="view-action-btn export" onClick={() => window.print()}>
                      <i className="fas fa-file-pdf"></i> Export PDF
                    </button>
                  </div>
                </div>

                <div className="view-info-grid">
                  <div className="info-item"><label>Course Enrolled</label><input value={student.student_course || ''} readOnly /></div>
                  <div className="info-item"><label>Course Duration</label><input value={student.course_duration || ''} readOnly /></div>
                  <div className="info-item"><label>NFC ID</label><input value={student.nfc_uid || ''} readOnly /></div>
                  <div className="info-item"><label>Birthdate</label><input value={student.student_birthdate || ''} readOnly /></div>
                  <div className="info-item"><label>Address</label><input value={student.student_address || ''} readOnly /></div>
                  <div className="info-item"><label>Contact Number</label><input value={student.student_cellnum || ''} readOnly /></div>
                </div>

                <div className="view-guardian-section">
                  <h3>Guardian Information</h3>
                  <div className="view-info-grid guardian">
                    <div className="info-item"><label>Guardian Name</label><input value={student.guardian_name || ''} readOnly /></div>
                    <div className="info-item"><label>Contact Details</label><input value={student.guardian_cellnum || ''} readOnly /></div>
                    <div className="info-item"><label>Address</label><input value={student.guardian_address || ''} readOnly /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </div>
  );
}

export default ViewRecord;
