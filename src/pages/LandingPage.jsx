import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-left">
        <div className="landing-text">
          <div className="landing-title-line">
            <span className="landing-title-dark">A+ Solution</span><br></br>
            <span className="landing-title-orange">Development Center</span>
          </div>
          <p className="landing-description">
            Championing innovation and leadership, we spearhead
            the advancement of robotics education in our region,
            empowering young minds to become tomorrow's
            trailblazers, problem-solvers, and industry leaders.
          </p>
          <button className="landing-btn" onClick={() => navigate('/login')}>
            Login to Portal →
          </button>
        </div>
      </div>

      <div className="landing-right">
        <img
          src="/branding.png"
          alt="A+ Solutions"
          className="landing-branding"
          onError={(e) => e.target.style.display = 'none'}
        />
      </div>

      <div className="landing-footer">
        © 2026 A+ Solution Development Center. All rights reserved.
      </div>
    </div>
  );
}

export default LandingPage;