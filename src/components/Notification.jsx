import { useEffect } from 'react';
import '../styles/Notification.css';

function Notification({ isOpen, onClose, message, type = 'success' }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Auto-dismiss after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyle = {
    top: '30px',
    right: '30px',
    bottom: 'auto',
  };

  return (
    <div className={`notification ${type} ${isOpen ? 'show' : ''}`} style={positionStyle}>
      <div className="notification-icon">
        {type === 'success' ? (
          <i className="fas fa-check-circle"></i>
        ) : (
          <i className="fas fa-exclamation-circle"></i>
        )}
      </div>
      <span className="notification-message">{message}</span>
    </div>
  );
}

export default Notification;