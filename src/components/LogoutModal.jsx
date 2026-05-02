import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import Notification from './Notification';
import '../styles/Modal.css';

function LogoutModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      onClose();
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
      window.location.reload();
    }
  };

  if (!isOpen && !showSuccess) return null;

  return (
    <>
      <Notification
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        message="Logged out successfully. See you next time!"
        type="success"
      />
      {isOpen && (
        <div className="modal-overlay show" onClick={onClose}>
          <div className="logout-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <i className="fas fa-sign-out-alt"></i>
            </div>
            <div className="logout-modal-title">Confirm Logout</div>
            <div className="logout-modal-message">Are you sure you want to log out?</div>
            <div className="logout-modal-buttons">
              <button className="logout-modal-btn logout-modal-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="logout-modal-btn logout-modal-btn-confirm" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default LogoutModal;