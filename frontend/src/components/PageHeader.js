import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const PAGE_META = {
  '/dashboard':     { title: 'Dashboard',     icon: '🏠', back: null },
  '/attendance':    { title: 'Attendance',     icon: '📅', back: '/dashboard' },
  '/courses':       { title: 'Classes',        icon: '🎓', back: '/dashboard' },
  '/my-course':     { title: 'My Course',      icon: '📚', back: '/dashboard' },
  '/assignments':   { title: 'Assignments',    icon: '📝', back: '/dashboard' },
  '/notifications': { title: 'Notifications',  icon: '🔔', back: '/dashboard' },
  '/analytics':     { title: 'Analytics',      icon: '📊', back: '/dashboard' },
  '/leaderboard':   { title: 'Leaderboard',    icon: '🏆', back: '/dashboard' },
  '/weekly-report': { title: 'Weekly Report',  icon: '📋', back: '/dashboard' },
  '/profile':       { title: 'Profile',        icon: '👤', back: '/dashboard' },
};

export default function PageHeader() {
  const { user, logout, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [time, setTime]         = useState(new Date());

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const path = location.pathname;
  // match /assignment/:date → assignments
  const metaKey = path.startsWith('/assignment/') ? '/assignments'
    : path.startsWith('/chat/')        ? '/dashboard'
    : path;
  const meta = PAGE_META[metaKey] || { title: 'CodeMedha', icon: '🏠', back: '/dashboard' };

  const isDash = metaKey === '/dashboard';

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

  const handleLogout = () => { logout(); navigate('/student/login'); };

  const hBg     = isDark ? '#0d1118' : '#ffffff';
  const hBorder = isDark ? '#1e2535' : '#e2e8f0';
  const hText   = isDark ? '#ffffff' : '#1a1a2e';
  const hMuted  = isDark ? '#555'    : '#94a3b8';
  const accent  = '#00d4aa';

  return (
    <div style={{
      position: 'fixed', top: 0,
      left: isMobile ? 0 : 240, right: 0,
      height: 64, zIndex: 150,
      background: hBg,
      borderBottom: `1px solid ${hBorder}`,
      boxShadow: isDark ? '0 1px 12px rgba(0,0,0,0.4)' : '0 1px 8px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
      boxSizing: 'border-box',
    }}>

      {/* Back button — every page except Dashboard */}
      {!isDash && (
        <button
          onClick={() => navigate(meta.back || '/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 10,
            border: `1.5px solid ${hBorder}`,
            background: isDark ? '#1e2535' : '#f0f4f8',
            color: isDark ? '#94a3b8' : '#64748b',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          ← Back
        </button>
      )}

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: hText, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span>{meta.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.title}</span>
        </div>
        <div style={{ fontSize: 11, color: hMuted, marginTop: 1 }}>
          {isDash
            ? `${greetIcon} ${greeting}, ${user?.name?.split(' ')[0] || 'Student'}!`
            : `${time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
          }
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Clock — only on dashboard desktop */}
        {isDash && !isMobile && (
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, background: isDark ? '#1e2535' : '#f0f4f8', padding: '6px 14px', borderRadius: 20, border: `1px solid ${hBorder}`, fontVariantNumeric: 'tabular-nums' }}>
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
        )}

        {/* Date pill */}
        {!isMobile && (
          <div style={{ fontSize: 12, color: hMuted, fontWeight: 600, background: isDark ? '#1e2535' : '#f0f4f8', padding: '6px 12px', borderRadius: 20, border: `1px solid ${hBorder}` }}>
            📅 {time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: isDark ? accent : '#e2e8f0', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}
        >
          <div style={{ position: 'absolute', top: 3, left: isDark ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, transition: 'left 0.3s' }}>
            {isDark ? '🌙' : '☀️'}
          </div>
        </button>

        {/* Avatar */}
        <div
          onClick={() => navigate('/profile')}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4aa,#7c6af5)', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          {(user?.name || 'S')[0].toUpperCase()}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: isMobile ? '6px 10px' : '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
        >
          {isMobile ? '⏻' : 'Logout'}
        </button>
      </div>
    </div>
  );
}