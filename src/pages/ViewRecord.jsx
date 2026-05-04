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
              {/* Top section: profile card left + student info right */}
              <div className="view-top-section">
                <div className="view-profile-card">
                  <h2>{student.student_name || 'Unknown Student'}</h2>
                  <p className="view-meta">NFC ID: {student.nfc_uid || 'XXXXXXX'}</p>
                  {student.student_course && (
                    <div className="view-course-badge">{student.student_course}</div>
                  )}
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

                <div className="view-main-panel">
                  <div className="view-panel-header">
                    <h3>Student Information</h3>
                    <div className="view-actions">
                      <button className="view-action-btn edit" onClick={() => navigate(`/students/${student.student_id}/edit`, { state: { student } })}>
                        <i className="fas fa-pencil-alt"></i> Edit Profile
                      </button>
                      <button
                        className="view-action-btn export"
                        onClick={() => {
                          if (!student) return;
                          const params = new URLSearchParams({
                            student_id: student.student_id,
                            date_from: attendanceLogs.length > 0 ? attendanceLogs[attendanceLogs.length - 1].attendanceDate || '' : '',
                            date_to: attendanceLogs.length > 0 ? attendanceLogs[0].attendanceDate || '' : '',
                            _t: String(Date.now()),
                          });
                          window.open(`${import.meta.env.VITE_API_BASE_URL}/students/export_record.php?${params.toString()}`, '_blank');
                        }}
                      >
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

              {/* Bottom section: full-width attendance logs */}
              <div className="view-logs-section">
                <div className="view-logs-header">
                  <span>Attendance Logs</span>
                </div>
                <div className="view-logs-body">
                  {isLoadingLogs ? (
                    <div className="empty-log-state"><p>Loading logs...</p></div>
                  ) : attendanceLogs.length === 0 ? (
                    <div className="empty-log-state">
                      <i className="fas fa-clipboard-list"></i>
                      <p>No attendance logs for this date.</p>
                    </div>
                  ) : (
                    <table className="view-logs-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time In</th>
                          <th>Time Out</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceLogs.map((log, index) => {
                          const status = getLogStatus(log);
                          return (
                            <tr key={`${log.attendance_id || 'log'}-${index}`}>
                              <td>{formatDate(log.attendanceDate)}</td>
                              <td>{formatTime(log.time_in)}</td>
                              <td>{log.time_out ? formatTime(log.time_out) : 'Active'}</td>
                              <td><span className={`log-badge ${status.toLowerCase()}`}>{status}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
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