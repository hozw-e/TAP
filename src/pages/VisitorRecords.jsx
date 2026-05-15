import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import LogoutModal from '../components/LogoutModal';
import Notification from '../components/Notification';
import api from '../services/api';
import '../styles/VisitorRecords.css';

function VisitorRecords() {
  const [visitors, setVisitors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });

  // Filter states
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination state
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10
  });

  // Fetch visitor records
  const fetchVisitors = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = {
        page,
        from_date: fromDate,
        to_date: toDate,
      };
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/visitors/list.php', { params });

      if (response.data.success) {
        setVisitors(response.data.data);
        setPagination(response.data.pagination);
        setCurrentPage(page);
      } else {
        showNotificationMsg(response.data.message || 'Failed to fetch visitor records', 'error');
      }
    } catch (error) {
      console.error('Error fetching visitors:', error);
      const message = error.response?.data?.message || 'Error fetching visitor records';
      showNotificationMsg(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchVisitors(1);
  };

  // Handle date filter
  const handleDateFilter = () => {
    setCurrentPage(1);
    fetchVisitors(1);
  };

  // Handle export (PDF)
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/visitors/export.php', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `visitor_records_${fromDate}_to_${toDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotificationMsg('Visitor records exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting visitors:', error);
      showNotificationMsg('Error exporting visitor records', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Show notification
  const showNotificationMsg = (message, type = 'success') => {
    setNotification({ isOpen: true, message, type });
  };

  // Handle Enter key on search
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  // Fetch on mount
  useEffect(() => {
    fetchVisitors(1);
  }, []);

  return (
    <div className="visitor-records-container">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="visitor-records-content">
        <TopBar />
        <div className="visitor-records-main">
          <div className="page-header">
            <h1>Visitor Records</h1>
          </div>

          {/* Search Bar */}
          <div className="visitor-search-section">
            <div className="visitor-search-container">
              <input
                type="text"
                className="visitor-search-input"
                placeholder="Search for names..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button className="visitor-search-btn" onClick={handleSearch}>
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>

          {/* Table Section */}
          <div className="visitor-table-section">
            {/* Filters Header */}
            <div className="visitor-filters-section">
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
              <button
                onClick={handleDateFilter}
                className="filter-search-btn"
                disabled={isLoading}
              >
                <i className="fas fa-search"></i>
              </button>
              <button
                onClick={handleExport}
                className="export-btn"
                disabled={isLoading || isExporting || visitors.length === 0}
              >
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>

            {/* Table */}
            <div className="visitor-table-wrapper">
              {isLoading ? (
                <div className="loading-state">Loading visitor records...</div>
              ) : visitors.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-user-friends"></i>
                  <p>No visitor records found</p>
                </div>
              ) : (
                <table className="visitor-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Name</th>
                      <th>Date of Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map((visitor, index) => (
                      <tr key={visitor.visit_id}>
                        <td>{(pagination.current_page - 1) * 10 + index + 1}</td>
                        <td>{visitor.name}</td>
                        <td>{formatDate(visitor.date_of_visit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => fetchVisitors(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {pagination.current_page} of {pagination.total_pages} ({pagination.total_count} total)
                </span>
                <button
                  onClick={() => fetchVisitors(currentPage + 1)}
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

export default VisitorRecords;
