//formerly Notification.jsx

import { useEffect } from 'react';
import '../styles/Notification.css';

function Notification({ isOpen, studentName, action, onClose }) {
  useEffect(() => {
    if (isOpen) {
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const message = action === 'TIME IN' 
    ? 'has entered the facility.' 
    : 'has left the facility.';

  return (
    <div className={`notification-popup ${isOpen ? 'show' : ''}`}>
      <div className="notification-header">
        <div className="notification-header-left">
          <i className="fas fa-bell"></i>
          <span>Notification</span>
        </div>
        <button className="notification-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="notification-body">
        <strong>{studentName}</strong> {message}
      </div>
    </div>
  );
}

export default Notification;
