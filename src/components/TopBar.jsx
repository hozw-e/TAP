import { useState, useEffect } from 'react';
import '../styles/TopBar.css';

function TopBar() {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      setClock(`${date} | ${h12}:${minutes} ${ampm}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="topbar">
      <span className="topbar-clock">{clock}</span>
    </div>
  );
}

export default TopBar;