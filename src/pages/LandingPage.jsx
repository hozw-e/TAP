import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      {/* Navigation Header */}
      <header className="landing-header">
        <div className="header-logo">
          <img src="/logo.png" alt="A+ Solutions Logo" className="logo-img" />
          <div className="logo-text">
            <span className="logo-title">A+ SOLUTIONS</span>
            <span className="logo-subtitle">DEVELOPMENT CENTER</span>
          </div>
        </div>
        <nav className="header-nav">
          <a href="#services" className="nav-link" onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}>Services</a>
          <a href="#contact" className="nav-link" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>Contact Us</a>
          <button className="nav-login-btn" onClick={() => navigate('/login')}>
            Login to Portal →
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Leading you to<br />
            <span className="hero-title-gradient">A+ SUCCESS!</span>
          </h1>
          <p className="hero-description">
            Championing innovation and leadership, A+ Solutions spearheads the advancement of robotics
            education in our region, empowering young minds to become tomorrow's trailblazers, problem-solvers,
            and industry leaders.
          </p>
          <button className="hero-btn" onClick={() => scrollToSection('services')}>Learn more</button>
        </div>
        <div className="hero-image">
          <img src="/hero.png" alt="A+ Success" className="hero-img" />
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="services-section">
        <h2 className="services-title">SERVICES</h2>
        <div className="services-grid">
          <div className="service-card">
            <img src="/coding.png" alt="Coding and Robotics" className="service-image" />
            <h3 className="service-name">Coding and Robotics</h3>
          </div>
          <div className="service-card">
            <img src="/academic.png" alt="Academic Tutorials" className="service-image" />
            <h3 className="service-name">Academic Tutorials</h3>
          </div>
          <div className="service-card">
            <img src="/innovation.png" alt="Innovation Projects" className="service-image" />
            <h3 className="service-name">Innovation Projects</h3>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="contact-info">
          <h2 className="contact-title">Get in touch with us!</h2>
          <p className="contact-description">
            A+ Solutions Development Center provides top-notch assistance
            to learners like you. Our experienced team is committed to
            helping you achieve your goals. Get in touch with us today and let's
            continue the journey to success together!
          </p>
          <p className="contact-channels">You can contact us through the following channels:</p>
          
          <div className="contact-details">
            <div className="contact-item">
              <svg className="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
              <span>facebook.com/APSDevCenter</span>
            </div>
            <div className="contact-item">
              <svg className="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span>info@apsolutionph.com</span>
            </div>
            <div className="contact-item">
              <svg className="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>+63 917 832 0822</span>
            </div>
          </div>

          <p className="contact-visit">Or you can visit us at our center:</p>
          <div className="contact-address">
            <svg className="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>35-A National Highway, Lower Kalakan, Olongapo City, Philippines 2200</span>
          </div>
        </div>

        <div className="contact-map">
          <iframe
            title="A+ Solutions Development Center Location"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3856.8202585485387!2d120.27499007543302!3d14.835342535679283!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x339671701d55f689%3A0x8911489ad1cbd7db!2sA%2B%20Solutions%20Development%20Center!5e0!3m2!1sen!2sph!4v1778164776671!5m2!1sen!2sph"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        © 2026 A+ Solution Development Center. All rights reserved.
      </footer>
    </div>
  );
}

export default LandingPage;