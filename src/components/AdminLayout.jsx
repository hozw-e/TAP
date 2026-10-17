import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import LogoutModal from './LogoutModal';

function AdminLayout({ children, className, connectionState, onRetryConnection }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Mobile drawer state. The sidebar is a fixed rail on desktop and a slide-in
  // drawer on narrow screens; this controls the drawer's open/closed state.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes (e.g. after tapping a nav item).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`admin-layout ${className || ''}`}>
      <Sidebar
        onLogoutClick={() => setShowLogoutModal(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Dim overlay behind the drawer on mobile; tap to close. */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="admin-content">
        <TopBar
          connectionState={connectionState}
          onRetryConnection={onRetryConnection}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <div className="admin-content-body">
          {children}
        </div>
      </div>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </div>
  );
}

export default AdminLayout;
