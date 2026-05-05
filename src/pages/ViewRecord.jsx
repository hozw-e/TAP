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
  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
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
        // Normalize logs by date string
        const normalizedLogs = logsData.map((log) => ({
          ...log,
          attendanceDate: log.date || log.log_date || log.date_created || log.created_at || null,
        }));

        // Build a map for quick lookup by date
        const logMap = {};
        normalizedLogs.forEach((log) => {
          if (log.attendanceDate) {
            logMap[log.attendanceDate] = log;
          }
        });

        // Get enrollment date
        const enrollmentDateStr = student?.created_at || student?.enrollment_date;
        const enrollmentDate = enrollmentDateStr ? new Date(enrollmentDateStr) : null;
        const today = new Date();

        // Generate all dates from enrollment to today (Mon-Sat)
        let allDates = [];
        if (enrollmentDate) {
          let current = new Date(enrollmentDate);
          current.setHours(0, 0, 0, 0);
          while (current <= today) {
            const day = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            if (day !== 0) { // Exclude Sundays
              allDates.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
          }
        }

        // Merge logs with allDates
        const mergedLogs = allDates.map((dateObj) => {
          const dateStr = dateObj.toISOString().slice(0, 10);
          const log = logMap[dateStr];
          if (log) {
            // Determine status
            let status = 'Absent';
            if (log.time_in && log.time_out) status = 'Present';
            else if (log.time_in && !log.time_out) status = 'No Time Out';
            return {
              ...log,
              attendanceDate: dateStr,
              status,
            };
          } else {
            return {
              attendanceDate: dateStr,
              time_in: null,
              time_out: null,
              status: 'Absent',
            };
          }
        });

        // Sort by date descending
        mergedLogs.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
        setAttendanceLogs(mergedLogs);
        // Set default filter dates
        if (mergedLogs.length > 0) {
          setFilterFrom(mergedLogs[mergedLogs.length - 1].attendanceDate);
          setFilterTo(mergedLogs[0].attendanceDate);
        }
      } catch (error) {
        console.error('Error loading attendance logs:', error);
        setAttendanceLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadAttendanceLogs();
  }, [student, studentId]);

  // Filtered logs for display
  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      // Date filter
      if (filterFrom && log.attendanceDate < filterFrom) return false;
      if (filterTo && log.attendanceDate > filterTo) return false;
      // Status filter
      if (filterStatus !== 'All' && getLogStatus(log) !== filterStatus) return false;
      return true;
    });
  }, [attendanceLogs, filterFrom, filterTo, filterStatus]);

  const studentStatus = useMemo(() => {
    if (!attendanceLogs.length) return 'No Recent Logs';
    const latest = attendanceLogs[0];
    return latest?.time_out ? 'Inactive' : 'Active';
  }, [attendanceLogs]);

  // Use log.status if present, otherwise fallback
  const getLogStatus = (log) => {
    if (log?.status) return log.status;
    if (!log?.time_in) return 'Absent';
    if (log?.time_in && !log?.time_out) return 'No Time Out';
    if (log?.time_in && log?.time_out) return 'Present';
    return '';
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
    <div className="students-layout" style={{ overflow: 'visible', height: 'auto' }}>
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
                <div className="view-logs-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 18 }}>Attendance Logs</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                    <label style={{ marginRight: 4 }}>From</label>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ marginRight: 8 }} />
                    <label style={{ marginRight: 4 }}>To</label>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ marginRight: 8 }} />
                    <label style={{ marginRight: 4 }}>Status</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ marginRight: 8 }}>
                      <option value="All">All</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="No Time Out">No Time Out</option>
                    </select>
                  </div>
                </div>
                <div className="view-logs-body">
                  {isLoadingLogs ? (
                    <div className="empty-log-state"><p>Loading logs...</p></div>
                  ) : filteredAttendanceLogs.length === 0 ? (
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
                        {filteredAttendanceLogs.map((log, index) => {
                          const status = getLogStatus(log);
                          return (
                            <tr key={`${log.attendance_id || 'log'}-${index}`}>
                              <td>{formatDate(log.attendanceDate)}</td>
                              <td>{formatTime(log.time_in)}</td>
                              <td>{log.time_out ? formatTime(log.time_out) : '--'}</td>
                              <td>
                                <span
                                  className="log-badge"
                                  style={{
                                    backgroundColor:
                                      status === 'Present'
                                        ? '#4caf50' // green
                                        : status === 'Absent'
                                        ? '#f44336' // red
                                        : status === 'No Time Out'
                                        ? '#ffeb3b' // yellow
                                        : '#e0e0e0',
                                    color:
                                      status === 'No Time Out'
                                        ? '#333'
                                        : '#fff',
                                    fontWeight: 600,
                                    borderRadius: '12px',
                                    padding: '2px 12px',
                                    display: 'inline-block',
                                    minWidth: '90px',
                                    textAlign: 'center',
                                  }}
                                >
                                  {status}
                                </span>
                              </td>
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