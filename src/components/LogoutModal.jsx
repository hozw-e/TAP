import { authAPI } from '../services/api';
import '../styles/Modal.css';

function LogoutModal({ isOpen, onClose }) {

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      onClose();
      sessionStorage.setItem('showLoggedOutToast', 'true');
      setTimeout(() => {
        window.location.replace('/apdc/login');
      }, 1500);
    } catch (error) {
      console.error('Logout error:', error);
      sessionStorage.setItem('showLoggedOutToast', 'true');
      window.location.replace('/apdc/login');
    }
  };

  if (!isOpen) return null;

  return (
    <>
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