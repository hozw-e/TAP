import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/Login.css';

function Login({ setIsAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login(username, password);
      
      if (response.success) {
        setIsAuthenticated(true);
        navigate('/dashboard');
      } else {
        setError(response.message || 'Invalid username or password');
      }
    } catch (err) {
      setError('Connection error. Please check your server.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo */}
        <div className="logo-container">
          <img src="/logo.png" alt="A+ Solutions Logo" onError={(e) => e.target.style.display = 'none'} />
        </div>

        {/* Header */}
        <div className="login-header">
          <h2>Admin Panel</h2>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message show">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div className="form-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={isLoading}
            />
            <div className="icon-container">
              <span className="user-icon"></span>
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <div 
              className="icon-container toggle-password" 
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className={`eye-icon ${showPassword ? 'hide' : ''}`}></span>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading"></span> Logging in...
              </>
            ) : (
              'Log in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
