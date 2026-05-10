import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import Notification from '../components/Notification';
import '../styles/ActivityLogs.css';
import api, { activityLogsAPI } from '../services/api';

function ActivityLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });

  // Filter states
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Fetch activity logs
  const fetchLogs = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = {
        page,
        from_date: fromDate,
        to_date: toDate,
      };
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
      link.download = `activity_logs_${fromDate}_to_${toDate}.pdf`;
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

  // Handle logout
  const handleLogout = () => {
    navigate('/login');
  };

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
      <Sidebar onLogoutClick={handleLogout} />
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
                <div className="empty-state">No activity logs found</div>
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

            {/* Pagination - bottom-right of table card */}
            {pagination.total_pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => fetchLogs(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {pagination.current_page} of {pagination.total_pages} ({pagination.total_count} total)
                </span>
                <button
                  onClick={() => fetchLogs(currentPage + 1)}
                  disabled={currentPage === pagination.total_pages || isLoading}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
