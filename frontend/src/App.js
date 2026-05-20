import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Attendance from './pages/Attendance';
import AssignmentPage from './pages/AssignmentPage';
import CoursePage from './pages/CoursePage';
import AdminPanel from './pages/AdminPanel';
import TrainerPanel from './pages/TrainerPanel';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import GroupChatPage from './pages/GroupChatPage';
import MyCourse from './pages/MyCourse';

// ── Error Boundary ─────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crash caught by ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0d14',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'system-ui, sans-serif',
          padding: 24, textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#f55555', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.hash = '#/student/login'; }}
            style={{
              background: '#00d4aa', color: '#000', border: 'none',
              borderRadius: 10, padding: '12px 28px',
              fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Go to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Install Banner ─────────────────────────────────────────────
function InstallBanner() {
  const { user } = useAuth();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBanner, setShowBanner]       = useState(false);
  const [dismissed, setDismissed]         = useState(false);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  useEffect(() => {
    if (isStandalone || dismissed) return;
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShowBanner(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone, dismissed]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setShowBanner(false);
    setInstallPrompt(null);
  };

  if (isStandalone || !showBanner || dismissed || !user) return null;

  const roleConfig = {
    student:  { color: '#00d4aa', label: 'Trainee',  icon: '🎓' },
    trainer:  { color: '#8b5cf6', label: 'Trainer',  icon: '👨‍💻' },
    teacher:  { color: '#8b5cf6', label: 'Trainer',  icon: '👨‍💻' },
    admin:    { color: '#ef4444', label: 'Admin',    icon: '👑' },
  };
  const cfg = roleConfig[user?.role] || roleConfig.student;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: `linear-gradient(135deg, ${cfg.color}dd, ${cfg.color}99)`,
      backdropFilter: 'blur(10px)',
      color: '#fff', padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      fontFamily: 'system-ui, sans-serif',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Install LMS {cfg.label} App</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Use on Phone/Laptop as an App</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button onClick={() => setDismissed(true)} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none',
          color: '#fff', borderRadius: 8, padding: '8px 14px',
          cursor: 'pointer', fontSize: 13,
        }}>Later</button>
        <button onClick={handleInstall} style={{
          background: '#fff', border: 'none',
          color: cfg.color, fontWeight: 700,
          borderRadius: 8, padding: '8px 18px',
          cursor: 'pointer', fontSize: 13,
        }}>Install ✓</button>
      </div>
    </div>
  );
}

// ── Private Route guard ────────────────────────────────────────
// FIX: Wait for isLoading before redirecting — prevents race condition
// that caused Tasks tab → Login page redirect on app load.
const PrivateRoute = ({ children, roles }) => {
  const { token, user, isLoading } = useAuth();

  // Still reading localStorage / verifying token — show spinner, NOT redirect
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#0a0d14',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid #2a2a3e',
          borderTop: '3px solid #00d4aa',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!token) {
    const path = window.location.hash || window.location.pathname;
    if (path.includes('/admin'))   return <Navigate to="/admin/login" />;
    if (path.includes('/trainer')) return <Navigate to="/trainer/login" />;
    return <Navigate to="/student/login" />;
  }

  if (roles && user && !roles.includes(user.role)) {
    if (user.role === 'admin')                              return <Navigate to="/admin" />;
    if (user.role === 'teacher' || user.role === 'trainer') return <Navigate to="/trainer" />;
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// ── App ───────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <InstallBanner />
            <Routes>
              {/* Login pages */}
              <Route path="/student/login" element={<Login role="student" />} />
              <Route path="/trainer/login" element={<Login role="trainer" />} />
              <Route path="/admin/login"   element={<Login role="admin"   />} />
              <Route path="/login"         element={<Navigate to="/student/login" />} />
              <Route path="/"              element={<Navigate to="/student/login" />} />

              {/* Student pages */}
              <Route path="/dashboard"        element={<PrivateRoute roles={['student']}><Dashboard /></PrivateRoute>} />
              <Route path="/attendance"       element={<PrivateRoute roles={['student']}><Attendance /></PrivateRoute>} />
              <Route path="/assignment/:date" element={<PrivateRoute roles={['student']}><AssignmentPage /></PrivateRoute>} />
              <Route path="/courses"          element={<PrivateRoute roles={['student']}><CoursePage /></PrivateRoute>} />
              <Route path="/my-course"        element={<PrivateRoute roles={['student']}><MyCourse /></PrivateRoute>} />
              <Route path="/weekly-report"    element={<PrivateRoute roles={['student']}><WeeklyReportPage /></PrivateRoute>} />

              {/* Trainer page */}
              <Route path="/trainer" element={<PrivateRoute roles={['teacher','trainer','admin']}><TrainerPanel /></PrivateRoute>} />

              {/* Admin page */}
              <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminPanel /></PrivateRoute>} />

              {/* Common */}
              <Route path="/profile"        element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
              <Route path="/notifications"  element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
              <Route path="/analytics"      element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
              <Route path="/leaderboard"    element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
              <Route path="/chat/:courseId" element={<PrivateRoute><GroupChatPage /></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/student/login" />} />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
