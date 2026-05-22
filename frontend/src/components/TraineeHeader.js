import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const PAGE_META = {
  '/dashboard':      { label: 'Dashboard',     icon: '🏠', home: true },
  '/attendance':     { label: 'Attendance',     icon: '📅' },
  '/courses':        { label: 'Classes',        icon: '🎓' },
  '/my-course':      { label: 'My Course',      icon: '📚' },
  '/analytics':      { label: 'Analytics',      icon: '📊' },
  '/leaderboard':    { label: 'Leaderboard',    icon: '🏆' },
  '/notifications':  { label: 'Notifications',  icon: '🔔' },
  '/profile':        { label: 'Profile',        icon: '👤' },
  '/weekly-report':  { label: 'Weekly Report',  icon: '📋' },
};

export default function TraineeHeader({ title, icon }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Derive label from route if not passed as prop
  const path = location.pathname;
  // Handle dynamic paths like /assignment/:date, /chat/:id
  let meta = PAGE_META[path];
  if (!meta) {
    if (path.startsWith('/assignment/')) meta = { label: 'Assignment', icon: '📝' };
    else if (path.startsWith('/chat/'))  meta = { label: 'Group Chat',  icon: '💬' };
    else meta = { label: title || 'Page', icon: icon || '📄' };
  }
  const isHome = path === '/dashboard';

  const hdrBg     = isDark ? '#1e293b' : '#ffffff';
  const hdrBorder = isDark ? '#334155' : '#f1f5f9';
  const hdrText   = isDark ? '#f1f5f9' : '#1e1b4b';
  const hdrSub    = isDark ? '#94a3b8' : '#64748b';
  const dateBg    = isDark ? '#0f172a'  : '#f8fafc';
  const dateBdr   = isDark ? '#334155' : '#e2e8f0';
  const backBg    = isDark ? '#1e293b' : '#f8fafc';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 240, right: 0, zIndex: 50,
      height: 64,
      background: hdrBg,
      borderBottom: `1px solid ${hdrBorder}`,
      boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.4)' : '0 1px 8px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}>
      {/* Left: back + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {!isHome && (
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10,
              border: `1.5px solid ${hdrBorder}`,
              background: backBg,
              color: hdrSub,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit',
            }}>
            ← Back
          </button>
        )}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: hdrText, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
          <div style={{ fontSize: 11, color: hdrSub, marginTop: 1 }}>
            {greeting}, {(user?.name || 'Student').split(' ')[0]}! 👋
          </div>
        </div>
      </div>

      {/* Right: date + dark toggle + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: hdrSub, fontWeight: 600, background: dateBg, padding: '6px 14px', borderRadius: 20, border: `1px solid ${dateBdr}` }}>
          📅 {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: isDark ? '#6366f1' : '#e2e8f0',
            position: 'relative', transition: 'background 0.3s', flexShrink: 0,
          }}>
          <div style={{
            position: 'absolute', top: 3,
            left: isDark ? 21 : 3,
            transition: 'left 0.3s',
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
          }}>
            {isDark ? '🌙' : '☀️'}
          </div>
        </button>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg,#00d4aa,#7c6af5)',
          color: '#fff', fontWeight: 700, fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,212,170,0.35)',
          flexShrink: 0,
        }}>
          {user?.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
      </div>
    </div>
  );
}