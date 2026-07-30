import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';
import '../styles/Dashboard.css';
import '../styles/StudentLogs.css';

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

function StudentLogs() {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Type & course filters
  const [filterType, setFilterType] = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');

  // Pagination
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const indexOfFirstRecord = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexOfLastRecord = currentPage * ITEMS_PER_PAGE;

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

  // Load on mount
  useEffect(() => {
    loadLogs();
  }, []);

  // Apply filters whenever logs or filter state changes
  useEffect(() => {
    applyFilters(attendanceLogs);
  }, [attendanceLogs, filterType, filterCourse]);

  // Reset to first page whenever the filtered set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLogs.length]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const logsResponse = await api.get('/dashboard/logs.php', { params });

      const logs = logsResponse.data?.success && Array.isArray(logsResponse.data.data)
        ? logsResponse.data.data : [];
      setAttendanceLogs(logs);
    } catch (error) {
      console.error('Student Logs error:', error);
      setAttendanceLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = (logs) => {
    let result = [...logs];

    if (filterType === 'Student') {
      result = result.filter(l => l.row_type === 'student');
    } else if (filterType === 'Visitor') {
      result = result.filter(l => l.row_type === 'visitor');
    }

    if (filterCourse !== 'All' && filterType !== 'Visitor') {
      result = result.filter(l => l.student_course === filterCourse);
    }

    setFilteredLogs(result);
  };

  const handleFilter = () => loadLogs();

  const handleExport = async () => {
    try {
      const params = {
        type: filterType,
        course: filterCourse,
      };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await api.get('/dashboard/export.php', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fromLabel = dateFrom || 'all';
      const toLabel = dateTo || 'latest';
      link.download = `attendance_${fromLabel}_to_${toLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '---';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return '---';
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch { return '---'; }
  };

  const calculateDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '---';
    try {
      const toSec = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
      const diff = toSec(timeOut) - toSec(timeIn);
      if (diff < 0) return '---';
      return `${Math.floor(diff / 3600)} hrs ${Math.floor((diff % 3600) / 60)} mins`;
    } catch { return '---'; }
  };

  const getNotificationStatus = (log) => {
    if (log.row_type === 'visitor') return 'N/A';
    if (log.msg_channel && log.msg_success) {
      return 'SMS';
    }
    if (log.msg_success === 0 || log.msg_success === false) {
      return 'FAILED';
    }
    return 'N/A';
  };

  const getStatus = (log) => {
    if (log.row_type === 'visitor') return 'VISITOR';
    return log.time_out ? 'LEFT' : 'PRESENT';
  };

  return (
    <AdminLayout className="dashboard-layout student-logs-page">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Attendance Logs</h1>
          </div>
        </div>

        {/* Attendance Logs */}
        <div className="logs-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="logs-header">
            <span>Attendance Logs</span>
            <div className="logs-controls">
              <label className="filter-label">From</label>
              <input type="date" className="date-picker" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <label className="filter-label">To</label>
              <input type="date" className="date-picker" value={dateTo} onChange={e => setDateTo(e.target.value)} />

              {/* Type filter */}
              <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="All">All Types</option>
                <option value="Student">Student</option>
                <option value="Visitor">Visitor</option>
              </select>

              {/* Course filter */}
              <select
                className="filter-select"
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
                disabled={filterType === 'Visitor'}
              >
                <option value="All">All Courses</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button className="refresh-btn" onClick={handleFilter}>
                <i className="fas fa-search"></i>
              </button>

              <button className="export-btn" onClick={handleExport} style={{ marginLeft: '4px' }}>
                <i className="fas fa-file-pdf"></i> Export PDF
              </button>
            </div>
          </div>

          <div className="logs-body">
            {isLoading ? (
              <div className="empty-state">
                <div className="spinner"></div>
                <p>Loading attendance logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard-list"></i>
                <p>No attendance logs for this date.</p>
              </div>
            ) : (
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Duration</th>
                    <th>Notification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((log) => (
                    <tr key={`${log.row_type}-${log.attendance_id}`}>
                      <td>{log.student_name || 'Unknown'}</td>
                      <td>{formatTime(log.time_in)}</td>
                      <td>{formatTime(log.time_out)}</td>
                      <td>{log.row_type === 'visitor' ? (log.time_out ? calculateDuration(log.time_in, log.time_out) : 'N/A') : calculateDuration(log.time_in, log.time_out)}</td>
                      <td>
                        <span className={`sms-badge ${
                          log.row_type === 'visitor' ? 'sms-na' :
                          getNotificationStatus(log) === 'SMS' ? 'sms-sent' :
                          getNotificationStatus(log) === 'FAILED' ? 'sms-failed' : 'sms-na'
                        }`}>
                          {getNotificationStatus(log)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${log.row_type === 'visitor' ? 'status-visitor' : getStatus(log) === 'PRESENT' ? 'status-present' : 'status-left'}`}>
                          {getStatus(log)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {filteredLogs.length > ITEMS_PER_PAGE && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredLogs.length)} of {filteredLogs.length} records
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
    </AdminLayout>
  );
}

export default StudentLogs;
