import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nfcAPI, authAPI, visitorsAPI } from '../services/api';
import '../styles/VisitorPage.css';

function VisitorPage() {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');

  // Welcome/Farewell modal (NFC tap)
  const [modal, setModal] = useState({ show: false, type: '', name: '' });


  
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

  // Student card modal (NFC tap of a student card in visitor mode)
  const [studentCardModal, setStudentCardModal] = useState({ show: false });

  // Name required modal (NFC tap with empty name)
  const [nameRequiredModal, setNameRequiredModal] = useState({ show: false });

  // Tap ID reminder modal (when user presses Enter)
  const [tapReminderModal, setTapReminderModal] = useState({ show: false });

  // Already checked in modal
  const [alreadyCheckedInModal, setAlreadyCheckedInModal] = useState({ show: false, name: '' });

  // NFC polling
  const intervalRef = useRef(null);
  const lastUIDRef  = useRef(null);
  const visitorNameRef = useRef('');

  // Auto-dismiss NFC modal after 3 seconds
  useEffect(() => {
    if (modal.show) {
      const timer = setTimeout(() => setModal({ show: false, type: '', name: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [modal.show]);


  
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

  // Auto-dismiss student card modal after 4 seconds
  useEffect(() => {
    if (studentCardModal.show) {
      const timer = setTimeout(() => setStudentCardModal({ show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [studentCardModal.show]);

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

  // Set scanner mode to 'visitor' on mount, restore to 'attendance' on unmount
  useEffect(() => {
    nfcAPI.setMode('visitor').catch(err => console.error('Failed to set visitor mode:', err));
    nfcAPI.clearScan().finally(() => {
      startPolling();
    });
    return () => {
      stopPolling();
      nfcAPI.setMode('attendance').catch(err => console.error('Failed to restore attendance mode:', err));
    };
  }, []);

  const startPolling = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const response = await nfcAPI.getLastScan();
        if (response.success && response.data.uid) {
          const { uid } = response.data;
          if (uid !== lastUIDRef.current) {
            lastUIDRef.current = uid;
            await nfcAPI.clearScan();

            // get-last-scan.php only returns fully processed scans,
            // so we can use the result directly without calling scan.php again
            const { status, action, student_name, time_since_checkin, required_time, uid: scannedUid, name: scannedVisitorName } = response.data;

            if (status === 'assigned') {
              // Student card scanned in attendance mode (shouldn't happen in visitor mode, but handle gracefully)
              setModal({ show: true, type: action === 'check_in' ? 'welcome' : 'farewell', name: student_name });
            } else if (status === 'denied') {
              const remainingTime = required_time - time_since_checkin;
              setDeniedModal({ show: true, name: student_name, remainingTime });
            } else if (status === 'student_card') {
              // Student card tapped in visitor mode — show error
              setStudentCardModal({ show: true });
            } else if (status === 'visitor_checkout') {
              // Visitor checked out via scan.php inline logic
              try {
                const checkoutResponse = await visitorsAPI.checkoutNFC(scannedUid);
                const checkoutName = (checkoutResponse.data && checkoutResponse.data.name) || scannedVisitorName || 'Visitor';
                setModal({ show: true, type: 'farewell', name: checkoutName });
              } catch (err) {
                // Fallback: show farewell with whatever name we have
                setModal({ show: true, type: 'farewell', name: scannedVisitorName || 'Visitor' });
              }
            } else if (status === 'unassigned') {
              // Unassigned tag in visitor mode — need to check if name is filled
              const currentName = visitorNameRef.current.trim();
              if (!currentName) {
                // Show "enter name first" error
                setNameRequiredModal({ show: true });
              } else {
                // Call checkinNFC with the name from the input field
                try {
                  const checkinResponse = await visitorsAPI.checkinNFC(currentName, scannedUid);
                  if (checkinResponse.success && checkinResponse.data) {
                    if (checkinResponse.data.created === true) {
                      setModal({ show: true, type: 'welcome', name: currentName });
                      setVisitorName(''); // Clear input
                    } else if (checkinResponse.data.status === 'already_checked_in') {
                      setAlreadyCheckedInModal({ show: true, name: currentName });
                    }
                  }
                } catch (err) {
                  console.error('NFC check-in error:', err);
                }
              }
            } else if (status === 'error_unassigned') {
              setUnassignedModal({ show: true });
            }

            // Reset lastUID after modals dismiss so the same card can be tapped again.
            // We use a delay slightly longer than the longest modal auto-dismiss (5s for denied)
            // to prevent the same scan from being picked up twice, while still allowing
            // the student to tap again for their next action.
            setTimeout(() => { lastUIDRef.current = null; }, 5000);
          }
        }
      } catch (e) {
        // silent fail
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

  return (
    <div className="visitor-page">
      {/* Logo top right */}
      <img src="/logo.png" alt="A+ Solutions" className="visitor-logo" onError={(e) => e.target.style.display = 'none'} />

      {/* Back button top left */}
      <button className="visitor-back-btn" onClick={handleBackClick}>
        <i className="fas fa-chevron-left"></i>
      </button>

      {/* Main content */}
      <div className="visitor-content">
        <h1 className="visitor-title">Welcome to A+ Center!</h1>
        <p className="visitor-subtitle">Please enter your name and tap your <strong>NFC</strong> card to check in</p>

        <form className="visitor-form" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            className="visitor-input"
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
        <div className="nfc-status">
          <i className="fas fa-wifi"></i>
          <span>NFC Reader is Active</span>
        </div>
      </div>

      {/* Welcome / Farewell Modal (NFC Tap) */}
      {modal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal">
            <div className="visitor-modal-icon">
              <i className={`fas ${modal.type === 'welcome' ? 'fa-check-circle' : 'fa-sign-out-alt'}`}></i>
              <p>{modal.type === 'welcome' ? 'Tap-in successful' : 'Tap-out successful. Have a great day!'}</p>
            </div>
            <h2>
              {modal.type === 'welcome' ? `Welcome, ${modal.name}!` : `Goodbye, ${modal.name}!`}
            </h2>
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
          </div>
        </div>
      )}



      {/* Already Tapped In Modal (Check-out Denied) */}
      {deniedModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal denied-modal">
            <div className="visitor-modal-icon denied-icon">
              <i className="fas fa-hourglass-half"></i>
              <p>You've Already Tapped In</p>
            </div>
            <h2>{deniedModal.name}</h2>
            <div className="session-status">
              <span className="status-badge active">
                <i className="fas fa-circle"></i> Session Active
              </span>
            </div>
            <p className="denied-message">
              Your entry has already been recorded for this session. Please wait for a minute to pass before tapping your ID to time out.
            </p>
          </div>
        </div>
      )}

      {/* Unassigned NFC Modal */}
      {unassignedModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal unassigned-modal">
            <div className="visitor-modal-icon unassigned-icon">
              <i className="fas fa-user-slash"></i>
              <p>This ID is not registered</p>
            </div>
            <h2>NFC not assigned</h2>
            <p className="unassigned-message">
              Please ask the admin personnel for assistance. Your NFC ID may not have been registered to your name.
            </p>
          </div>
        </div>
      )}

      {/* Student Card Error Modal */}
      {studentCardModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal unassigned-modal">
            <div className="visitor-modal-icon denied-icon">
              <i className="fas fa-exclamation-triangle"></i>
              <p>Wrong card type</p>
            </div>
            <h2>This card is not a visitor card</h2>
            <p className="unassigned-message">
              This NFC card is assigned to a student. Please use an unassigned visitor card instead.
            </p>
          </div>
        </div>
      )}

      {/* Name Required Modal */}
      {nameRequiredModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal unassigned-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-info-circle"></i>
              <p>Name required</p>
            </div>
            <h2>Please enter your name first</h2>
            <p className="unassigned-message">
              Type your name in the input field above, then tap your NFC card again to check in.
            </p>
          </div>
        </div>
      )}

      {/* Tap Visitor ID Reminder Modal */}
      {tapReminderModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal unassigned-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-id-card"></i>
              <p>Tap required</p>
            </div>
            <h2>Please tap your Visitor ID to login</h2>
            <p className="unassigned-message">
              Place your NFC visitor card on the reader to complete check-in.
            </p>
          </div>
        </div>
      )}

      {/* Already Checked In Modal */}
      {alreadyCheckedInModal.show && (
        <div className="visitor-modal-overlay">
          <div className="visitor-modal unassigned-modal">
            <div className="visitor-modal-icon">
              <i className="fas fa-check-circle"></i>
              <p>Already checked in</p>
            </div>
            <h2>You are already checked in</h2>
            <p className="unassigned-message">
              {alreadyCheckedInModal.name}, you have already checked in today. Tap again when you are ready to leave.
            </p>
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

      {/* Running Robot */}
      <img src="/robot.gif" alt="" className="running-robot" />

      {/* Footer */}
      <div className="footer-banner">
        <p>© 2026 A+ Solution Development Center. All rights reserved.</p>
      </div>
    </div>
  );
}

export default VisitorPage;