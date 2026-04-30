import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import VisitorPage from './pages/VisitorPage';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authAPI.checkSession();

      // ✅ FIX: Safely extract logged_in — handles both response shapes:
      //    { logged_in: true }  or  { data: { logged_in: true } }
      const loggedIn =
        response?.data?.logged_in ??
        response?.logged_in ??
        false;

      setIsAuthenticated(loggedIn === true);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIX: Show loading screen while auth check is in progress.
  // Prevents login page from flashing before session is verified.
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#7f8c8d'
      }}>
        Loading...
      </div>
    );
  }

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    return isAuthenticated ? children : <Navigate to="/" replace />;
  };

  return (
    <Router>
      <Routes>
        {/* Login Route - redirect to dashboard if already logged in */}
        <Route
          path="/"
          element={
            isAuthenticated ?
              <Navigate to="/dashboard" replace /> :
              <Login setIsAuthenticated={setIsAuthenticated} />
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <Students />
            </ProtectedRoute>
          }
        />

        {/* Visitor Page - public, no auth required */}
        <Route path="/visitor" element={<VisitorPage />} />

        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;