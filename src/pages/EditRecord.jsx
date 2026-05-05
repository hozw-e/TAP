import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import { attendanceAPI, guardiansAPI, studentsAPI } from '../services/api';
import '../styles/Students.css';
import '../styles/ViewRecordModal.css';

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
      if (!student?.student_id) return;
      setIsLoadingLogs(true);
      try {
        const response = await attendanceAPI.list({ student_id: student.student_id });
        const logsData = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];
        setAttendanceLogs(logsData.slice(0, 5));
      } catch (error) {
        console.error('Error loading attendance logs:', error);
        setAttendanceLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadAttendanceLogs();
  }, [student]);

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
                              <td>{formatDate(log.log_date || log.date_created || log.created_at)}</td>
                              <td>{log.time_in ? log.time_in : '--'}</td>
                              <td>{log.time_out ? log.time_out : (status === 'Present' ? 'Active' : '--')}</td>
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
