import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import '../styles/ActivityLogs.css';
import api, { activityLogsAPI } from '../services/api';

function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });

  // Filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionType, setActionType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination state
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10
  });

  // Action type options
  const actionTypes = [
    { value: '', label: 'All' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'NFC_ASSIGN', label: 'NFC Assignment' },
    { value: 'EXPORT', label: 'Export' }
  ];

  // Pagination page numbers
  const getPageNumbers = () => {
    const totalPages = pagination.total_pages;
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

  // Fetch activity logs
  const fetchLogs = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = { page };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (actionType) params.action_type = actionType;

      const response = await api.get('/activity-logs/list.php', { params });

      if (response.data.success) {
        setLogs(response.data.data);
        setPagination(response.data.pagination);
        setCurrentPage(page);
      } else {
        showNotification(response.data.message || 'Failed to fetch activity logs', 'error');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      const message = error.response?.data?.message || 'Error fetching activity logs';
      showNotification(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchLogs(1);
  };

  // Handle export (PDF)
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const filters = { from_date: fromDate, to_date: toDate };
      if (actionType) filters.action_type = actionType;

      const blob = await activityLogsAPI.export(filters);

      // Trigger a client-side download from the blob
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      const fromLabel = fromDate || 'all';
      const toLabel = toDate || 'latest';
      link.download = `activity_logs_${fromLabel}_to_${toLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('Activity logs exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting logs:', error);
      showNotification('Error exporting activity logs', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ isOpen: true, message, type });
    setTimeout(() => {
      setNotification({ isOpen: false, message: '', type: 'success' });
    }, 3000);
  };

  // Logout modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Fetch logs on component mount
  useEffect(() => {
    fetchLogs(1);
  }, []);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Get action badge color
  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'CREATE':
        return 'badge-create';
      case 'UPDATE':
        return 'badge-update';
      case 'DELETE':
        return 'badge-delete';
      case 'LOGIN':
        return 'badge-login';
      case 'LOGOUT':
        return 'badge-logout';
      case 'NFC_ASSIGN':
        return 'badge-nfc';
      case 'EXPORT':
        return 'badge-export';
      default:
        return 'badge-default';
    }
  };

  return (
    <div className="activity-logs-container">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="activity-logs-content">
        <TopBar />
        <div className="activity-logs-main">
          <div className="page-header">
            <h1>Activity Logs</h1>
          </div>

          {/* Filters and Table Combined */}
          <div className="logs-section">
            {/* Filters Header */}
            <div className="filters-section">
              <label className="filter-label-inline">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="date-input"
              />
              <label className="filter-label-inline">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="date-input"
              />
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="action-select"
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFilterChange}
                className="filter-search-btn"
                disabled={isLoading}
              >
                <i className="fas fa-search"></i>
              </button>
              <button
                onClick={handleExport}
                className="export-btn"
                disabled={isLoading || isExporting || logs.length === 0}
              >
                <i className="fas fa-file-pdf"></i> {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>

            {/* Logs Table */}
            <div className="logs-table-wrapper">
              {isLoading ? (
                <div className="loading-state">Loading activity logs...</div>
              ) : logs.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard-list"></i>
                <p>No records yet</p>
              </div>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Timestamp</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Entity Type</th>
                      <th>Entity Name</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr key={log.id}>
                        <td>{(pagination.current_page - 1) * 10 + index + 1}</td>
                        <td>{formatTimestamp(log.timestamp)}</td>
                        <td>{log.admin_name}</td>
                        <td>
                          <span className={`action-badge ${getActionBadgeClass(log.action_type)}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td>{log.entity_type}</td>
                        <td>{log.entity_name}</td>
                        <td className="details-cell">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Showing {(pagination.current_page - 1) * pagination.per_page + 1}-{Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} records
                </span>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => fetchLogs(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
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
                        onClick={() => fetchLogs(page)}
                        disabled={isLoading}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => fetchLogs(currentPage + 1)}
                    disabled={currentPage === pagination.total_pages || isLoading}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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

export default ActivityLogs;
