import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

function Sidebar({ onLogoutClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="logo-circle">
        <img src="/logo.png" alt="A+ Solutions" onError={(e) => e.target.style.display = 'none'} />
      </div>

      {/* Navigation Items */}
      <div
        className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
        onClick={() => navigate('/dashboard')}
      >
        <i className="fas fa-th-large"></i>
        <span>Dashboard</span>
      </div>

      <div
        className={`nav-item ${isActive('/students') ? 'active' : ''}`}
        onClick={() => navigate('/students')}
      >
        <i className="fas fa-users"></i>
        <span>Student Record</span>
      </div>

      <div
        className={`nav-item ${isActive('/visitor') ? 'active' : ''}`}
        onClick={() => navigate('/visitor')}
      >
        <i className="fas fa-door-open"></i>
        <span>Visitor's Login</span>
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <hr className="sidebar-divider" />
        <button className="help-btn" onClick={() => {}}>
          <i className="fas fa-question-circle"></i>
          <span>Help</span>
        </button>
        <button className="logout-btn" onClick={onLogoutClick}>
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;