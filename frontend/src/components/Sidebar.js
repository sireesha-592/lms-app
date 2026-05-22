import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/dashboard',      icon: '🏠' },
  { label: 'Attendance',    path: '/attendance',      icon: '📅' },
  { label: 'Classes',       path: '/courses',         icon: '🎓' },
  { label: 'My Course',     path: '/my-course',       icon: '📚' },
  { label: 'Assignments',   path: '/assignments',     icon: '📝' },
  { label: 'Notifications', path: '/notifications',   icon: '🔔' },
  { label: 'Analytics',     path: '/analytics',       icon: '📊' },
  { label: 'Leaderboard',   path: '/leaderboard',     icon: '🏆' },
  { label: 'Group Chat',    path: '/chat',            icon: '💬' },
  { label: 'Weekly Report', path: '/weekly-report',   icon: '📋' },
  { label: 'Profile',       path: '/profile',         icon: '👤' },
];

// FIX: BOTTOM_NAV uses icons + correct paths.
// The Tasks path is /assignments — resolved dynamically below to /assignment/:today
// so it never hits an unmatched route that redirects to Login.
const BOTTOM_NAV = [
  { label: 'Home',   path: '/dashboard',  icon: '🏠' },
  { label: 'Attend', path: '/attendance', icon: '📅' },
  { label: 'Tasks',  path: '/assignments',icon: '📝' },
  { label: 'Stats',  path: '/analytics',  icon: '📊' },
  { label: 'Me',     path: '/profile',    icon: '👤' },
];

export default function Sidebar({ activePath, courseId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const today = new Date().toISOString().split('T')[0];
  const currentPath = activePath || location.pathname;

  // Resolve dynamic paths for BOTH sidebar drawer AND bottom nav
  const resolvePath = (path) => {
    if (path === '/chat') {
      const cId = courseId || user?.enrolledCourse;
      return cId ? `/chat/${cId}` : '/courses';
    }
    if (path === '/assignments') {
      // FIX: resolve to today's assignment — no /assignments route exists, only /assignment/:date
      return `/assignment/${today}`;
    }
    return path;
  };

  const resolvedNav = NAV_ITEMS.map(item => ({ ...item, path: resolvePath(item.path) }));

  // FIX: also resolve bottom nav paths so Tasks navigates correctly
  const resolvedBottomNav = BOTTOM_NAV.map(item => ({ ...item, path: resolvePath(item.path) }));

  // Active-state check: /assignment/:date paths → highlight Tasks tab
  const isPathActive = (itemOriginalPath, resolvedItemPath) => {
    if (itemOriginalPath === '/assignments') {
      return location.pathname.startsWith('/assignment/');
    }
    return location.pathname === resolvedItemPath || location.pathname === itemOriginalPath;
  };

  const navBtn = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 10, border: 'none',
    background: isActive ? theme.navActiveBg : 'transparent',
    color: isActive ? theme.navActiveColor : theme.navInactiveColor,
    fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
    textAlign: 'left', transition: 'all 0.2s', width: '100%',
    minHeight: 40, boxSizing: 'border-box',
  });

  if (isMobile) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Open navigation menu"
          style={{
            position: 'fixed', top: 9, left: 10, zIndex: 1200,
            background: theme.sidebarBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, width: 40, height: 40,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, cursor: 'pointer', padding: 0,
            minWidth: 40, minHeight: 40,
          }}
        >
          <span style={{ display: 'block', width: 18, height: 2, background: theme.textPrimary, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 2, background: theme.textPrimary, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 2, background: theme.textPrimary, borderRadius: 2 }} />
        </button>

        {/* Backdrop */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100 }}
          />
        )}

        {/* Slide-in drawer */}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'min(280px, 80vw)',
          background: theme.sidebarBg, borderRight: `1px solid ${theme.border}`,
          zIndex: 1150,
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          display: 'flex', flexDirection: 'column',
          padding: '16px 0',
          overflowY: 'auto', overflowX: 'hidden',
          paddingLeft: 'env(safe-area-inset-left)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px 24px' }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700, flexShrink: 0 }}>C</div>
            <span style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CodeMedha</span>
          </div>

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
            {resolvedNav.map(item => {
              const isActive = currentPath === item.path || location.pathname === item.path;
              return (
                <button key={item.label} style={navBtn(isActive)} onClick={() => navigate(item.path)}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '16px 20px',
            borderTop: `1px solid ${theme.border}`,
            marginTop: 'auto',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Student'}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>MERN Stack Developer</div>
            </div>
          </div>
        </div>

        {/* Bottom navigation bar */}
        <div
          data-bottom-nav
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
            background: theme.sidebarBg, borderTop: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
            zIndex: 1000,
            paddingTop: 0,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {resolvedBottomNav.map((item, idx) => {
            // FIX: check active against original path for /assignments → /assignment/:date
            const originalPath = BOTTOM_NAV[idx].path;
            const isActive = isPathActive(originalPath, item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 3,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  flex: 1, height: 60, minWidth: 0, padding: '6px 4px',
                }}
              >
                {isActive && (
                  <div style={{ width: 20, height: 3, borderRadius: 2, background: theme.navActiveColor, marginBottom: 2 }} />
                )}
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span
                  data-bottom-nav-label
                  style={{
                    fontSize: 10, fontWeight: 700,
                    color: isActive ? theme.navActiveColor : theme.textMuted,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  /* Desktop sidebar — fixed, same dark design as Trainer/Admin */
  return (
    <aside style={{
      width: 240,
      background: '#0d1118',
      borderRight: '1px solid #1e2535',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0,
      height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      zIndex: 200, flexShrink: 0,
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 16px', borderBottom: '1px solid #1e2535' }}>
        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 800, flexShrink: 0 }}>C</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>CodeMedha</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: 1.2 }}>Student Portal</div>
        </div>
      </div>

      {/* Profile card */}
      <div style={{ margin: '12px 10px', background: 'rgba(0,212,170,0.06)', borderRadius: 12, padding: '14px', textAlign: 'center', border: '1px solid rgba(0,212,170,0.12)' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 auto 8px' }}>
          {user?.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{user?.name || 'Student'}</div>
        <div style={{ display: 'inline-block', background: 'rgba(0,212,170,0.15)', color: '#00d4aa', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>🎓 Trainee</div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, padding: '4px 8px' }}>
        {resolvedNav.map(item => {
          const isActive = isPathActive(item.path, item.path);
          return (
            <button key={item.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: '0 8px 8px 0',
                border: 'none', borderLeft: isActive ? '3px solid #00d4aa' : '3px solid transparent',
                background: isActive ? 'rgba(0,212,170,0.1)' : 'transparent',
                color: isActive ? '#00d4aa' : '#555',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                width: '100%',
              }}
              onClick={() => navigate(item.path)}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
              {isActive && <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#00d4aa' }} />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderTop: '1px solid #1e2535' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {user?.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Student'}</div>
          <div style={{ fontSize: 10, color: '#444' }}>MERN Stack Developer</div>
        </div>
      </div>
    </aside>
  );
}