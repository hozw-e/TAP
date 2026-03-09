import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/Modal.css';

function LogoutModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      navigate('/');
      window.location.reload(); // Force refresh to clear state
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
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
  );
}

export default LogoutModal;
