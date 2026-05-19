import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import { attendanceAPI, studentsAPI } from '../services/api';
import api from '../services/api';
import '../styles/Students.css';
import '../styles/ViewRecordModal.css';
import TopBar from '../components/TopBar';

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
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  useEffect(() => {
    const loadStudent = async () => {
      if (student) return;
      setIsLoadingStudent(true);
      try {
        // Try active students first, then archived
        let found = null;
        for (const archived of [false, true]) {
          const response = await studentsAPI.list(archived);
          const studentsData = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.data)
              ? response.data.data
              : [];
          found = studentsData.find((item) => String(item.student_id) === String(studentId));
          if (found) break;
        }
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

  // Use log.status if present, otherwise fallback
  const getLogStatus = (log) => {
    if (log?.status) return log.status;
    if (!log?.time_in) return 'Absent';
    if (log?.time_in && !log?.time_out) return 'No Time Out';
    if (log?.time_in && log?.time_out) return 'Present';
    return '';
  };

  const studentStatus = useMemo(() => {
    if (student?.is_archived === 1 || student?.is_archived === '1' || student?.is_archived === true) return 'Inactive';
    return 'Active';
  }, [student]);

  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      if (filterFrom && log.attendanceDate < filterFrom) return false;
      if (filterTo && log.attendanceDate > filterTo) return false;
      if (filterStatus !== 'All' && getLogStatus(log) !== filterStatus) return false;
      return true;
    });
  }, [attendanceLogs, filterFrom, filterTo, filterStatus]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterFrom, filterTo, filterStatus]);

  const totalPages = Math.ceil(filteredAttendanceLogs.length / logsPerPage);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * logsPerPage;
    return filteredAttendanceLogs.slice(start, start + logsPerPage);
  }, [filteredAttendanceLogs, currentPage]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
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

  const handleExportPDF = async () => {
    if (!student) return;

    try {
      const response = await api.get('/students/export_record.php', {
        params: {
          student_id: student.student_id,
          date_from: filterFrom || '',
          date_to: filterTo || '',
          status: filterStatus || 'All'
        },
        responseType: 'blob',
      });

      // Create a download link from the blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fromLabel = filterFrom || 'all';
      const toLabel = filterTo || 'latest';
      link.download = `student_attendance_${student.student_id}_${fromLabel}_to_${toLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
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
          <div className="view-record-page-content">
            <button className="view-back-btn" onClick={() => navigate('/students')}>
              <i className="fas fa-chevron-left"></i> Back
            </button>

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
                    <button
                      className="view-action-btn export"
                      style={{ marginLeft: '12px' }}
                      onClick={handleExportPDF}
                    >
                      <i className="fas fa-file-pdf"></i> Export PDF
                    </button>
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
                          <th>SMS Notification</th>
                          <th>Time Out</th>
                          <th>SMS Notification</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.map((log, index) => {
                          const status = getLogStatus(log);
                          const timeInSms = log.time_in
                            ? (log.sms_sent_in === true || log.sms_sent_in === 1) ? 'SENT' : 'FAILED'
                            : null;
                          const timeOutSms = log.time_out
                            ? (log.sms_sent_out === true || log.sms_sent_out === 1) ? 'SENT' : 'FAILED'
                            : null;
                          return (
                            <tr key={`${log.attendance_id || 'log'}-${index}`}>
                              <td>{formatDate(log.attendanceDate)}</td>
                              <td>{formatTime(log.time_in)}</td>
                              <td>
                                {timeInSms ? (
                                  <span
                                    className="log-badge"
                                    style={{
                                      backgroundColor: timeInSms === 'SENT' ? '#2196f3' : '#f44336',
                                      color: '#fff',
                                      fontWeight: 600,
                                      borderRadius: '12px',
                                      padding: '2px 12px',
                                      display: 'inline-block',
                                      minWidth: '60px',
                                      textAlign: 'center',
                                      fontSize: '11px',
                                    }}
                                  >
                                    {timeInSms}
                                  </span>
                                ) : (
                                  <span style={{ color: '#aaa' }}>--</span>
                                )}
                              </td>
                              <td>{log.time_out ? formatTime(log.time_out) : '--'}</td>
                              <td>
                                {timeOutSms ? (
                                  <span
                                    className="log-badge"
                                    style={{
                                      backgroundColor: timeOutSms === 'SENT' ? '#2196f3' : '#f44336',
                                      color: '#fff',
                                      fontWeight: 600,
                                      borderRadius: '12px',
                                      padding: '2px 12px',
                                      display: 'inline-block',
                                      minWidth: '60px',
                                      textAlign: 'center',
                                      fontSize: '11px',
                                    }}
                                  >
                                    {timeOutSms}
                                  </span>
                                ) : (
                                  <span style={{ color: '#aaa' }}>--</span>
                                )}
                              </td>
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
                {/* Sticky Pagination Footer */}
                {totalPages > 1 && (
                  <div className="view-logs-pagination">
                    <span className="pagination-info">
                      Showing {(currentPage - 1) * logsPerPage + 1}-{Math.min(currentPage * logsPerPage, filteredAttendanceLogs.length)} of {filteredAttendanceLogs.length} records
                    </span>
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      {getPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button
                            key={page}
                            className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
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