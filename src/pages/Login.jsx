import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/Login.css';

const PRIVACY_POLICY = `PRIVACY POLICY
TAP: An IoT-Enabled Time and Attendance Platform Using NFC Technology with Automated Notification
Effective Date: May 20, 2026

1. Introduction
This Privacy Policy outlines the principles and practices governing the collection, processing, storage, and protection of personal data within the TAP Admin Portal. The system is designed to manage attendance using Near Field Communication (NFC) technology and automated notification features.

The TAP system adheres to the provisions of the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations (IRR), ensuring that all personal data is handled with transparency, legitimate purpose, and proportionality.

2. Scope of the Policy
This policy applies to all administrators and authorized personnel who access and manage data within the TAP system. It covers all personal and system-generated data collected through the platform.

3. Information We Collect
The system collects and processes the following categories of data:

3.1 Personal Information
• Full name
• Email address
• Contact number
• User role (e.g., administrator, staff)

3.2 Attendance Data
• Time-in and time-out records
• Attendance logs and history
• Date and time stamps

3.3 Device and Technical Information
• NFC Tag Unique Identifier (UID)
• Device ID and system identifiers
• IP address and browser information

3.4 System Usage Data
• Login credentials (encrypted)
• Access logs and activity history
• System interaction records

4. Legal Basis for Processing
In compliance with RA 10173, data processing is based on the following lawful criteria:
• Consent: When applicable, users provide consent for data processing
• Contractual Necessity: Processing required for system functionality
• Legal Obligation: Compliance with applicable laws and institutional requirements
• Legitimate Interest: Ensuring system security, efficiency, and performance

5. Purpose of Data Processing
Collected data is used strictly for the following purposes:
• To record and monitor attendance accurately
• To manage administrative operations within the system
• To generate reports, analytics, and summaries
• To send automated notifications and alerts
• To enhance system performance and user experience
• To ensure compliance with institutional and legal standards

6. Data Sharing and Disclosure
The TAP system does not sell, lease, or trade personal data. Data may be disclosed only under the following circumstances:
• To authorized personnel within the organization for legitimate operations
• To third-party service providers (e.g., cloud storage, notification services) bound by data protection agreements
• When required by law, regulation, or legal proceedings
• To protect the rights, safety, and security of users and the institution

7. Data Storage and Security Measures
The system implements appropriate technical, organizational, and physical security measures, including:
• Data encryption and secure authentication protocols
• Role-based access control for administrators
• Secure servers and cloud infrastructure
• Regular system monitoring and updates

Despite these measures, no electronic system is completely secure. The system continuously improves its safeguards to mitigate risks.

8. Data Retention Policy
Personal data is retained only for as long as necessary to fulfill its intended purpose or as required by law and institutional policies. After the retention period, data will be securely deleted or anonymized.

9. Rights of Data Subjects
In accordance with RA 10173, data subjects have the right to:
• Be informed about data collection and processing
• Access their personal data
• Correct inaccurate or outdated data
• Object to data processing, when applicable
• Request deletion or blocking of data
• File complaints with the National Privacy Commission (NPC)

10. Data Protection Officer (DPO)
The system administrator or assigned personnel shall act as the Data Protection Officer responsible for ensuring compliance with data privacy regulations.

11. Amendments to the Policy
This Privacy Policy may be updated periodically. Any changes will be communicated through the system. Continued use of the system constitutes acceptance of the updated policy.

12. Contact Information
For inquiries, requests, or concerns regarding this Privacy Policy, please contact: aplusolution@gmail.com`;

const TERMS_AND_CONDITIONS = `TERMS AND CONDITIONS
Effective Date: May 20, 2026

1. Acceptance of Terms
By accessing and using the TAP Admin Portal, administrators acknowledge that they have read, understood, and agreed to be bound by these Terms and Conditions and the corresponding Privacy Policy.

2. Description of Service
TAP is an IoT-enabled time and attendance management system that utilizes NFC technology to automate attendance tracking, reporting, and notification processes within an organization.

3. User Roles and Responsibilities
Administrators are responsible for:
• Managing user accounts and attendance records
• Ensuring the accuracy and integrity of stored data
• Safeguarding login credentials and system access
• Monitoring system activities and logs
• Reporting security breaches or unauthorized access immediately

4. Account Security
Users must maintain the confidentiality of their credentials. Any activity performed under an account shall be the responsibility of the account holder.

5. Acceptable Use Policy
Users agree to use the system only for lawful and authorized purposes. The following actions are strictly prohibited:
• Unauthorized access to system data or accounts
• Manipulation or falsification of attendance records
• Introduction of malicious software or harmful code
• Disruption of system performance or availability

6. Data Privacy Compliance
All users must comply with the provisions of the Philippine Data Privacy Act of 2012 (RA 10173). Unauthorized disclosure or misuse of personal data is subject to disciplinary and legal action.

7. Intellectual Property Rights
All system components, including but not limited to software, design, logos, and documentation, are the intellectual property of the developers unless otherwise stated. Unauthorized reproduction or distribution is prohibited.

8. System Availability
While efforts are made to ensure continuous availability, the system may experience downtime due to maintenance, updates, or unforeseen technical issues.

9. Limitation of Liability
The developers and administrators of the TAP system shall not be held liable for:
• Data loss due to technical failures or external attacks
• Temporary system unavailability
• Unauthorized access resulting from user negligence

10. Termination of Access
Access to the system may be suspended or permanently terminated in cases of:
• Violation of these Terms and Conditions
• Misuse of the system
• Engagement in unlawful or harmful activities

11. Amendments to Terms
These Terms and Conditions may be revised as necessary. Users will be notified of any significant changes. Continued use of the system constitutes acceptance of the updated Terms.

12. Governing Law
These Terms shall be governed by and interpreted in accordance with the laws of the Republic of the Philippines.

13. Contact Information
For questions or concerns regarding these Terms and Conditions, please contact: aplusolution@gmail.com`;

function Login({ setIsAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPPModal, setShowPPModal] = useState(false);
  const [showTCModal, setShowTCModal] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    if (!agreed) {
      setError('Please agree to the Privacy Policy & Terms and Conditions');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login(username, password);
      if (response.success) {
        setIsAuthenticated(true);
        navigate('/dashboard', { state: { justLoggedIn: true } });
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
    <>
      <div className="login-page">
        {/* Floating animated gears */}
        {[...Array(8)].map((_, i) => (
          <img key={i} src="/gear.png" alt="" className={`gear gear-${i + 1}`} />
        ))}

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
          {error && <div className="error-message show">{error}</div>}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
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

            <div className="form-group">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />
              <div className="icon-container toggle-password" onClick={() => setShowPassword(!showPassword)}>
                <span className={`eye-icon ${showPassword ? 'hide' : ''}`}></span>
              </div>
            </div>

            {/* PP & TC Checkbox */}
            <div className="pp-tc-row">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="agree">
                I agree to the{' '}
                <span className="pp-link" onClick={() => setShowPPModal(true)}>Privacy Policy</span>
                {' '}&#38;{' '}
                <span className="pp-link" onClick={() => setShowTCModal(true)}>Terms and Conditions</span>.
              </label>
            </div>

            <button type="submit" className="login-button" disabled={isLoading || !agreed}>
              {isLoading ? (<><span className="loading"></span> Logging in...</>) : 'Log in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2026 A+ Solution Development Center. All rights reserved.
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPPModal && (
        <div className="pp-modal-overlay" onClick={() => setShowPPModal(false)}>
          <div className="pp-modal-content" onClick={e => e.stopPropagation()}>
            <div className="pp-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {PRIVACY_POLICY.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('PRIVACY POLICY') || line.startsWith('TERMS') ? 'pp-section-main' : line.match(/^\d+\./) ? 'pp-section-title' : 'pp-section-text'}>
                  {line || <br />}
                </p>
              ))}
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button className="pp-understand-btn" onClick={() => setShowPPModal(false)}>I understand</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTCModal && (
        <div className="pp-modal-overlay" onClick={() => setShowTCModal(false)}>
          <div className="pp-modal-content" onClick={e => e.stopPropagation()}>
            <div className="pp-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {TERMS_AND_CONDITIONS.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('TERMS') ? 'pp-section-main' : line.match(/^\d+\./) ? 'pp-section-title' : 'pp-section-text'}>
                  {line || <br />}
                </p>
              ))}
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button className="pp-understand-btn" onClick={() => setShowTCModal(false)}>I understand</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Login;