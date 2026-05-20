import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleProfile = () => navigate('/profile');
  const handleLogout = () => {
    logout();
    navigate('/student/login');
  };

  const roleColor = user?.role === 'admin' ? '#e74c3c' : user?.role === 'trainer' ? '#8e44ad' : '#2980b9';

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, zIndex: 1000,
      /* On mobile: leave space for the hamburger button (left: 56px) */
      left: isMobile ? 56 : 0,
      height: 56,
      background: '#0f0f1a',
      borderBottom: '1px solid #2a2a3e',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      /* Tighter horizontal padding on mobile */
      padding: isMobile ? '0 12px' : '0 24px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      boxSizing: 'border-box',
    }}>
      {/* Logo — hidden on mobile because hamburger is to the left */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00d4aa, #0099ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 'bold', color: '#fff'
          }}>C</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>CodeMedha</span>
        </div>
      )}

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, marginLeft: 'auto' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={handleProfile} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              flexShrink: 0,
            }}>
              {(user.name || user.email || 'U')[0].toUpperCase()}
            </div>
            {/* Hide username text on very small screens to prevent overflow */}
            {!isMobile && (
              <span style={{ color: '#94a3b8', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                {user.name || user.email}
              </span>
            )}
          </div>
        )}
        <button onClick={handleLogout} style={{
          background: '#e74c3c', color: '#fff',
          border: 'none', borderRadius: 8,
          /* Narrower on mobile */
          padding: isMobile ? '6px 10px' : '6px 16px',
          cursor: 'pointer',
          fontSize: isMobile ? 12 : 14,
          fontWeight: 600,
          minHeight: 36,
          whiteSpace: 'nowrap',
        }}>
          {isMobile ? '⏻' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
