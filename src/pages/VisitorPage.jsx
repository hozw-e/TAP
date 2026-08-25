import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nfcAPI, authAPI, visitorsAPI } from '../services/api';
import '../styles/VisitorPage.css';

function VisitorPage() {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');
  const [activeMode, setActiveMode] = useState(null); // 'students' or 'visitors'

  // Welcome/Farewell modal (NFC tap)
  const [modal, setModal] = useState({ show: false, type: '', name: '', subtype: '' });

  // Dedicated check-out farewell modal
  const [farewellModal, setFarewellModal] = useState({ show: false, name: '', timeOut: '' });

  // Already tapped in modal (check-out denied)
  const [deniedModal, setDeniedModal] = useState({ show: false, name: '', remainingTime: 0 });

  // Unassigned NFC modal
  const [unassignedModal, setUnassignedModal] = useState({ show: false });

  // Admin login modal (back button)
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Name required modal (NFC tap with empty name)
  const [nameRequiredModal, setNameRequiredModal] = useState({ show: false });

  // Tap ID reminder modal (when user presses Enter)
  const [tapReminderModal, setTapReminderModal] = useState({ show: false });

  // Already checked in modal
  const [alreadyCheckedInModal, setAlreadyCheckedInModal] = useState({ show: false, name: '' });

  // NFC polling
  const intervalRef = useRef(null);
  const lastUIDRef = useRef(null);
  const visitorNameRef = useRef('');
  const pollFailCountRef = useRef(0);
  const [nfcActive, setNfcActive] = useState(true);

  // Auto-dismiss NFC modal after 5 seconds
  useEffect(() => {
    if (modal.show) {
      const timer = setTimeout(() => setModal({ show: false, type: '', name: '', subtype: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [modal.show]);

  // Auto-dismiss farewell modal after 5 seconds
  useEffect(() => {
    if (farewellModal.show) {
      const timer = setTimeout(() => setFarewellModal({ show: false, name: '', timeOut: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [farewellModal.show]);

  // Auto-dismiss denied modal after 5 seconds
  useEffect(() => {
    if (deniedModal.show) {
      const timer = setTimeout(() => setDeniedModal({ show: false, name: '', remainingTime: 0 }), 5000);
      return () => clearTimeout(timer);
    }
  }, [deniedModal.show]);

  // Auto-dismiss unassigned NFC modal after 4 seconds
  useEffect(() => {
    if (unassignedModal.show) {
      const timer = setTimeout(() => setUnassignedModal({ show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [unassignedModal.show]);

  // Auto-dismiss name required modal after 4 seconds
  useEffect(() => {
    if (nameRequiredModal.show) {
      const timer = setTimeout(() => setNameRequiredModal({ show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [nameRequiredModal.show]);

  // Auto-dismiss tap reminder modal after 4 seconds
  useEffect(() => {
    if (tapReminderModal.show) {
      const timer = setTimeout(() => setTapReminderModal({ show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [tapReminderModal.show]);

  // Auto-dismiss already checked in modal after 4 seconds
  useEffect(() => {
    if (alreadyCheckedInModal.show) {
      const timer = setTimeout(() => setAlreadyCheckedInModal({ show: false, name: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [alreadyCheckedInModal.show]);

  // Keep visitorNameRef in sync with visitorName state
  useEffect(() => {
    visitorNameRef.current = visitorName;
  }, [visitorName]);

  // Set scanner mode to 'attendance' on mount
  useEffect(() => {
    nfcAPI.setMode('attendance').catch(err => console.error('Failed to set attendance mode:', err));
    startPolling();
    return () => {
      stopPolling();
    };
  }, []);

  const startPolling = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const response = await nfcAPI.getLastScan();
        pollFailCountRef.current = 0;
        setNfcActive(true);
        const payload = response.data;
        if (payload?.success && payload?.data?.uid) {
          const { uid } = payload.data;
          if (uid !== lastUIDRef.current) {
            lastUIDRef.current = uid;
            await nfcAPI.clearScan();

            const { status, action, student_name, time_since_checkin, required_time, uid: scannedUid, name: scannedVisitorName } = payload.data;

            if (status === 'assigned') {
              if (action === 'check_in') {
                setModal({ show: true, type: 'welcome', name: student_name, subtype: 'student' });
              } else {
                setModal({ show: true, type: 'farewell', name: student_name, subtype: 'student' });
              }
            } else if (status === 'denied') {
              if (action === 'archived_denied') {
                setModal({ show: true, type: 'archived', name: student_name, subtype: 'student' });
              } else {
                setDeniedModal({ show: true, name: student_name });
              }
            } else if (status === 'student_card') {
              setDeniedModal({ show: true, name: student_name || '' });
            } else if (status === 'visitor' && action === 'visitor_checkout') {
              const checkoutName = payload.data.name || scannedVisitorName || 'Visitor';
              const checkoutTime = payload.data.time_out || '';
              setFarewellModal({ show: true, name: checkoutName, timeOut: checkoutTime });
            } else if (status === 'error_unassigned' || status === 'unassigned') {
              const currentName = visitorNameRef.current.trim();
              if (!currentName) {
                setNameRequiredModal({ show: true });
              } else {
                try {
                  const checkinResponse = await visitorsAPI.checkinNFC(currentName, scannedUid);
                  if (checkinResponse.success && checkinResponse.data) {
                    if (checkinResponse.data.created === true) {
                      setModal({ show: true, type: 'welcome', name: currentName, subtype: 'visitor' });
                      setVisitorName('');
                    } else if (checkinResponse.data.status === 'already_checked_in') {
                      setAlreadyCheckedInModal({ show: true, name: currentName });
                    }
                  }
                } catch (err) {
                  console.error('Visitor check-in error:', err);
                }
              }
            }

            setTimeout(() => { lastUIDRef.current = null; }, 5000);
          }
        }
      } catch (e) {
        pollFailCountRef.current += 1;
        if (pollFailCountRef.current >= 3) {
          setNfcActive(false);
        }
      }
    }, 500);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleBackClick = () => {
    setAdminError('');
    setAdminUsername('');
    setAdminPassword('');
    setShowAdminModal(true);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      const response = await authAPI.login(adminUsername, adminPassword);
      if (response.success) {
        stopPolling();
        await nfcAPI.setMode('attendance').catch(() => {});
        navigate('/dashboard');
      } else {
        setAdminError(response.message || 'Invalid credentials');
      }
    } catch (err) {
      setAdminError('Connection error. Please try again.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleModeSelect = (mode) => {
    setActiveMode(mode);
  };

  return (
    <div className="visitor-page">
      {/* ─── Left Panel (Dark) ─────────────────────────────────── */}
      <div className="vp-left-panel">
        {/* Gradient overlays */}
        <img src="/gradient1.png" alt="" className="vp-gradient vp-gradient-top-left" />
        <img src="/gradient 3.png" alt="" className="vp-gradient vp-gradient-bottom-left" />

        {/* Back button */}
        <button className="vp-back-btn" onClick={handleBackClick}>
          <i className="fas fa-chevron-left"></i>
        </button>

        {/* Mode selection cards */}
        <div className="vp-cards">
          {/* Students Card */}
          <div
            className={`vp-card vp-card-students ${activeMode === 'students' ? 'vp-card--active' : ''}`}
            onClick={() => handleModeSelect('students')}
          >
            <h3 className="vp-card-title">STUDENTS</h3>
            <div className="vp-card-body">
              <p className="vp-card-desc">Click here and then directly tap your ID in the terminal</p>
              <img src="/student.png" alt="Student scanning ID" className="vp-card-img" />
            </div>
          </div>

          {/* Visitors Card */}
          <div
            className={`vp-card vp-card-visitors ${activeMode === 'visitors' ? 'vp-card--active' : ''}`}
            onClick={() => handleModeSelect('visitors')}
          >
            <h3 className="vp-card-title">VISITORS</h3>
            <div className="vp-card-body">
              <p className="vp-card-desc">Click here, then type your name in the text field before tapping your Visitor ID in the terminal</p>
              <img src="/visitor.png" alt="Visitor typing name" className="vp-card-img" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Panel (White) ───────────────────────────────── */}
      <div className="vp-right-panel">
        {/* Gradient bleeding from left into right */}
        <img src="/gradient2.png" alt="" className="vp-gradient vp-gradient-right" />

        {/* Logo top right */}
        <img src="/logo.png" alt="A+ Solutions" className="vp-logo" onError={(e) => e.target.style.display = 'none'} />

        {/* Main content */}
        <div className="vp-right-content">
          <h1 className="vp-welcome-title">Welcome to A+ Center!</h1>

          <form className="vp-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              className="vp-input"
              placeholder="Type your name here..."
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (visitorName.trim()) {
                    setTapReminderModal({ show: true });
                  }
                }
              }}
            />
          </form>

          {/* NFC Reader Status */}
          <div className={`nfc-status ${nfcActive ? 'nfc-status--active' : 'nfc-status--inactive'}`}>
            <i className={`fas ${nfcActive ? 'fa-wifi' : 'fa-wifi-slash'}`}></i>
            <span>{nfcActive ? 'NFC Reader is Active' : 'NFC Reader is Offline'}</span>
            {nfcActive && <span className="nfc-pulse-dot"></span>}
          </div>
        </div>

        {/* Running Robot (only on right half) */}
        <img src="/robot.gif" alt="" className="vp-running-robot" />
      </div>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <div className="vp-footer">
        <p>© 2026 A+ Solution Development Center. All rights reserved.</p>
      </div>

      {/* ─── Modals ────────────────────────────────────────────── */}

      {/* Welcome Modal (Check-in) */}
      {modal.show && modal.type === 'welcome' && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal welcome-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-door-open result-icon"></i>
              <p className="result-label-welcome">
                {modal.subtype === 'student' ? 'ATTENDANCE RECORDED' : 'CHECK-IN RECORDED'}
              </p>
            </div>
            <h2 className="result-name">Welcome, {modal.name}!</h2>
            <p className="visitor-modal-timestamp">
              {new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Farewell Modal — student check-out */}
      {modal.show && modal.type === 'farewell' && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal farewell-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-walking result-icon farewell-walk-icon"></i>
              <p className="result-label-farewell">ATTENDANCE RECORDED</p>
            </div>
            <h2 className="result-name farewell-name">Goodbye, {modal.name}!</h2>
            <p className="visitor-modal-subtext">See you next session!</p>
            <p className="visitor-modal-timestamp">
              {new Date().toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long',
                day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Farewell Modal — visitor check-out */}
      {farewellModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal farewell-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-walking result-icon farewell-walk-icon"></i>
              <p className="result-label-farewell">CHECK-OUT RECORDED</p>
            </div>
            <h2 className="result-name farewell-name">Goodbye, {farewellModal.name}!</h2>
            <p className="visitor-modal-subtext">Thank you for visiting A+ Center.</p>
            <p className="visitor-modal-timestamp">
              {new Date().toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long',
                day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Archived Student Modal */}
      {modal.show && modal.type === 'archived' && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal denied-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-graduation-cap result-icon"></i>
              <p className="result-label-denied">SESSIONS COMPLETED</p>
            </div>
            <h2 className="result-name denied-name">{modal.name || 'Student'}</h2>
            <p className="visitor-modal-subtext">All sessions have been completed. Please see the admin.</p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Already Tapped In Modal (Check-out Denied) */}
      {deniedModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal denied-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-hourglass-half result-icon"></i>
              <p className="result-label-denied">SESSION ACTIVE</p>
            </div>
            <h2 className="result-name denied-name">You've Already Tapped In</h2>
            <p className="visitor-modal-subtext">
              {deniedModal.name ? `${deniedModal.name} — your` : 'Your'} session is still in progress.
            </p>
            <p className="visitor-modal-timestamp">Tap your card again when you're ready to leave.</p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Unassigned NFC Modal */}
      {unassignedModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal unassigned-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-ban result-icon"></i>
              <p className="result-label-error">UNREGISTERED CARD</p>
            </div>
            <h2 className="result-name error-name">NFC Card Not Found</h2>
            <p className="visitor-modal-subtext">Please ask admin personnel for assistance.</p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Name Required Modal */}
      {nameRequiredModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal info-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-keyboard result-icon"></i>
              <p className="result-label-info">ACTION REQUIRED</p>
            </div>
            <h2 className="result-name info-name">Enter Your Name First</h2>
            <p className="visitor-modal-subtext">Type your name above, then tap your NFC card to check in.</p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Tap Visitor ID Reminder Modal */}
      {tapReminderModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal info-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-id-card result-icon"></i>
              <p className="result-label-info">TAP REQUIRED</p>
            </div>
            <h2 className="result-name info-name">Now Tap Your Visitor Card</h2>
            <p className="visitor-modal-subtext">Place your NFC card on the reader to complete check-in.</p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Already Checked In Modal */}
      {alreadyCheckedInModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal visitor-result-modal info-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-user-clock result-icon"></i>
              <p className="result-label-info">ALREADY CHECKED IN</p>
            </div>
            <h2 className="result-name info-name">You're Already Inside</h2>
            <p className="visitor-modal-subtext">
              {alreadyCheckedInModal.name}, your visit is already recorded. Tap again when you're ready to leave.
            </p>
            <div className="result-dismiss-hint">Closes automatically…</div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="visitor-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="admin-login-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Admin Login Required</h2>
            {adminError && <div className="admin-error">{adminError}</div>}
            <form onSubmit={handleAdminLogin}>
              <div className="admin-form-group">
                <input
                  type="text"
                  placeholder="Username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={adminLoading}
                />
                <span className="admin-icon"><i className="fas fa-user"></i></span>
              </div>
              <div className="admin-form-group">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={adminLoading}
                />
                <span className="admin-icon toggle" onClick={() => setShowAdminPassword(!showAdminPassword)}>
                  <i className={`fas ${showAdminPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>
              <button type="submit" className="admin-login-btn" disabled={adminLoading}>
                {adminLoading ? 'Logging in...' : 'Log in'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitorPage;
