import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import LogoutModal from './LogoutModal';

function AdminLayout({ children, className, connectionState, onRetryConnection }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <div className={`admin-layout ${className || ''}`}>
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="admin-content">
        <TopBar
          connectionState={connectionState}
          onRetryConnection={onRetryConnection}
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
