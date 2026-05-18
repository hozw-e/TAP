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

  // Filter states (empty = all time)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination state
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10
  });

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

  // Fetch visitor records
  const fetchVisitors = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = { page };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
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
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
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

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
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
              <span className="visitor-filters-title">Visitor Attendance Logs</span>
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
                <i className="fas fa-file-pdf"></i> {isExporting ? 'Exporting...' : 'Export PDF'}
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
                      <th>Time In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map((visitor, index) => (
                      <tr key={visitor.visit_id}>
                        <td>{(pagination.current_page - 1) * 10 + index + 1}</td>
                        <td>{visitor.name}</td>
                        <td>{formatDate(visitor.date_of_visit)}</td>
                        <td>{formatTime(visitor.time_in)}</td>
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
                    onClick={() => fetchVisitors(currentPage - 1)}
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
                        onClick={() => fetchVisitors(page)}
                        disabled={isLoading}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => fetchVisitors(currentPage + 1)}
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

export default VisitorRecords;
