import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import { attendanceAPI, guardiansAPI, studentsAPI } from '../services/api';
import '../styles/Students.css';
import '../styles/ViewRecordModal.css';
import TopBar from '../components/TopBar';

function EditRecord() {
  const { studentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [student, setStudent] = useState(location.state?.student || null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingStudent, setIsLoadingStudent] = useState(!location.state?.student);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });
  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [formData, setFormData] = useState({
    studentCourse: '',
    courseDuration: '',
    nfcId: '',
    birthdate: '',
    address: '',
    contactNumber: '',
    guardianName: '',
    guardianContact: '',
    guardianAddress: '',
  });

  useEffect(() => {
    const loadStudent = async () => {
      if (student || !studentId) return;
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
    if (!student) return;
    setFormData({
      studentCourse: student.student_course || '',
      courseDuration: student.course_duration || '',
      nfcId: student.nfc_uid || '',
      birthdate: student.student_birthdate || '',
      address: student.student_address || '',
      contactNumber: student.student_cellnum || '',
      guardianName: student.guardian_name || '',
      guardianContact: student.guardian_cellnum || '',
      guardianAddress: student.guardian_address || '',
    });
  }, [student]);

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
        
        // Normalize actual logs and add status
        const actualLogs = logsData.map((log) => {
          let status = 'Absent';
          if (log.time_in && log.time_out) status = 'Present';
          else if (log.time_in && !log.time_out) status = 'No Time Out';
          
          return {
            ...log,
            attendanceDate: log.date || log.log_date || log.date_created || log.created_at || null,
            status,
            isActual: true,
          };
        });

        // Build a set of dates that have actual logs
        const datesWithLogs = new Set();
        actualLogs.forEach((log) => {
          if (log.attendanceDate) {
            datesWithLogs.add(log.attendanceDate);
          }
        });

        // Get enrollment date
        const enrollmentDateStr = student?.created_at || student?.enrollment_date;
        const enrollmentDate = enrollmentDateStr ? new Date(enrollmentDateStr) : null;
        const today = new Date();

        // Generate absent entries for dates without logs (Mon-Sat only)
        let absentLogs = [];
        if (enrollmentDate) {
          let current = new Date(enrollmentDate);
          current.setHours(0, 0, 0, 0);
          while (current <= today) {
            const day = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const dateStr = current.toISOString().slice(0, 10);
            
            // Only add absent entry if: it's Mon-Sat AND no actual log exists for this date
            if (day !== 0 && !datesWithLogs.has(dateStr)) {
              absentLogs.push({
                attendanceDate: dateStr,
                time_in: null,
                time_out: null,
                status: 'Absent',
                isActual: false,
              });
            }
            current.setDate(current.getDate() + 1);
          }
        }

        // Combine actual logs and absent logs
        const allLogs = [...actualLogs, ...absentLogs];

        // Sort by date descending (newest first)
        allLogs.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
        setAttendanceLogs(allLogs);
        
        // Set default filter dates
        if (allLogs.length > 0) {
          setFilterFrom(allLogs[allLogs.length - 1].attendanceDate);
          setFilterTo(allLogs[0].attendanceDate);
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

  const studentStatus = useMemo(() => {
    if (!attendanceLogs.length) return 'No Recent Logs';
    const latest = attendanceLogs[0];
    return latest?.time_out ? 'Inactive' : 'Active';
  }, [attendanceLogs]);

  const getLogStatus = (log) => {
    if (log?.status) return log.status;
    if (!log?.time_in) return 'Absent';
    if (log?.time_in && !log?.time_out) return 'No Time Out';
    if (log?.time_in && log?.time_out) return 'Present';
    return '';
  };

  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      if (filterFrom && log.attendanceDate < filterFrom) return false;
      if (filterTo && log.attendanceDate > filterTo) return false;
      if (filterStatus !== 'All' && getLogStatus(log) !== filterStatus) return false;
      return true;
    });
  }, [attendanceLogs, filterFrom, filterTo, filterStatus]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!student) return;
    const getApiErrorMessage = (error, fallback) => {
      return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
      );
    };

    if (!formData.address.trim()) {
      setNotification({ isOpen: true, message: 'Student address is required.', type: 'error' });
      return;
    }
    if (!(student.student_name || '').trim()) {
      setNotification({ isOpen: true, message: 'Student name is missing. Please reload and try again.', type: 'error' });
      return;
    }
    if (!formData.guardianName.trim()) {
      setNotification({ isOpen: true, message: 'Guardian name is required.', type: 'error' });
      return;
    }
    if (!student.guardian_id) {
      setNotification({ isOpen: true, message: 'Guardian ID is missing for this record.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const guardianResponse = await guardiansAPI.update(student.guardian_id, {
        guardian_name: formData.guardianName,
        guardian_address: formData.guardianAddress || null,
        guardian_cellnum: formData.guardianContact || null,
      });
      if (!guardianResponse.success) {
        throw new Error(guardianResponse.message || 'Failed to update guardian');
      }

      const studentResponse = await studentsAPI.update(student.student_id, {
        student_name: student.student_name,
        student_birthdate: formData.birthdate || null,
        student_address: formData.address,
        student_cellnum: formData.contactNumber || null,
        student_course: formData.studentCourse || null,
        course_duration: formData.courseDuration || null,
      });
      if (!studentResponse.success) {
        throw new Error(studentResponse.message || 'Failed to update student');
      }

      navigate(`/students/${student.student_id}`);
    } catch (error) {
      console.error('Error saving record:', error);
      setNotification({
        isOpen: true,
        message: getApiErrorMessage(error, 'Failed to save changes.'),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">
        <TopBar />
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
          <div className="view-record-page-content edit-record-page">
            <div className="view-record-topbar">
              <button className="view-back-btn" onClick={() => navigate(`/students/${student.student_id}`)}>
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
                      <button className="view-action-btn cancel" onClick={() => navigate(`/students/${student.student_id}`)} disabled={isSaving}>
                        Cancel
                      </button>
                      <button className="view-action-btn edit" onClick={handleSave} disabled={isSaving}>
                        <i className="fas fa-save"></i> {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>

                  <div className="view-info-grid">
                    <div className="info-item"><label>Course Enrolled</label><input name="studentCourse" value={formData.studentCourse} onChange={handleChange} /></div>
                    <div className="info-item"><label>Course Duration</label><input name="courseDuration" value={formData.courseDuration} onChange={handleChange} /></div>
                    <div className="info-item"><label>NFC ID</label><input name="nfcId" value={formData.nfcId} readOnly /></div>
                    <div className="info-item"><label>Birthdate</label><input name="birthdate" value={formData.birthdate} onChange={handleChange} type="date" /></div>
                    <div className="info-item"><label>Address</label><input name="address" value={formData.address} onChange={handleChange} /></div>
                    <div className="info-item"><label>Contact Number</label><input name="contactNumber" value={formData.contactNumber} onChange={handleChange} /></div>
                  </div>

                  <div className="view-guardian-section">
                    <h3>Guardian Information</h3>
                    <div className="view-info-grid guardian">
                      <div className="info-item"><label>Guardian Name</label><input name="guardianName" value={formData.guardianName} onChange={handleChange} /></div>
                      <div className="info-item"><label>Contact Details</label><input name="guardianContact" value={formData.guardianContact} onChange={handleChange} /></div>
                      <div className="info-item"><label>Address</label><input name="guardianAddress" value={formData.guardianAddress} onChange={handleChange} /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom section: full-width attendance logs */}
              <div className="view-logs-section">
                <div className="view-logs-header">
                  <span>Attendance Logs</span>
                  <div className="view-logs-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
                    <div className="view-logs-filters" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label>From</label>
                      <input type="date" className="view-filter-date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                      <label>To</label>
                      <input type="date" className="view-filter-date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                      <label>Status</label>
                      <select className="view-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="All">All</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="No Time Out">No Time Out</option>
                      </select>
                    </div>
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
                                        ? '#4caf50'
                                        : status === 'Absent'
                                          ? '#f44336'
                                          : status === 'No Time Out'
                                            ? '#ffeb3b'
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
      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}

export default EditRecord;
