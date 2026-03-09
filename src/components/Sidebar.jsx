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

      {/* Navigation Icons */}
      <div 
        className={`nav-icon ${isActive('/dashboard') ? 'active' : ''}`}
        title="Dashboard"
        onClick={() => navigate('/dashboard')}
      >
        <i className="fas fa-th-large"></i>
      </div>

      <div 
        className={`nav-icon ${isActive('/students') ? 'active' : ''}`}
        title="Students"
        onClick={() => navigate('/students')}
      >
        <i className="fas fa-users"></i>
      </div>

      {/* Logout Button */}
      <button className="logout-btn" onClick={onLogoutClick}>
        <i className="fas fa-sign-out-alt"></i> Logout
      </button>
    </div>
  );
}

export default Sidebar;
