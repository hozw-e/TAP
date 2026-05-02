import { useEffect, useMemo, useState } from 'react';
import { attendanceAPI } from '../services/api';
import '../styles/ViewRecordModal.css';

function ViewRecordModal({ isOpen, onClose, student, onEdit }) {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    const loadAttendanceLogs = async () => {
      if (!isOpen || !student?.student_id) return;

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
  }, [isOpen, student]);

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

  if (!isOpen || !student) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="view-record-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="view-record-topbar">
          <button className="view-back-btn" onClick={onClose}>
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
                        <span>{formatDate(log.log_date || log.date_created || log.created_at)}</span>
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
                <button className="view-action-btn edit" onClick={() => onEdit(student)}>
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
    </div>
  );
}

export default ViewRecordModal;
