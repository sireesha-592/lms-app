import Sidebar from '../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AttendanceCalendar from '../components/AttendanceCalendar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';

export default function Attendance() {
  const { user, token } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // FIX: resolve courseId same way Dashboard does —
  // user.enrolledCourse may be undefined even when user is enrolled.
  // Dashboard calls /api/courses/:userId to get it. Attendance was skipping this step,
  // so courseId was null → AttendanceCalendar's useEffect guard `if (courseId)` never fired → 0 days shown.
  const [resolvedCourseId, setResolvedCourseId] = useState(user?.enrolledCourse || null);

  useEffect(() => {
    if (!resolvedCourseId && user?._id && token) {
      api.get(`${API}/api/courses/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.data?.length > 0) setResolvedCourseId(res.data[0]._id);
        })
        .catch(() => {});
    }
  }, [user, token]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: theme.pageBg,
      color: theme.textPrimary,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      overflowX: 'hidden',
    }}>
      <Sidebar activePath="/attendance" courseId={resolvedCourseId} />

      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? '60px 12px 80px' : '28px 28px 20px',
        background: theme.pageBg,
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 8,
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0, marginBottom: 4, color: theme.textPrimary }}>
              📅 Attendance
            </h2>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Track your daily class attendance</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', borderRadius: 20,
            fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
            background: theme.cardBg, border: `1px solid ${theme.border}`, color: theme.accent,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', display: 'inline-block', boxShadow: '0 0 6px #00d4aa' }} />
            This Month
          </div>
        </div>

        {/* Calendar */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
        }}>
          {/* FIX: pass resolvedCourseId so calendar actually loads data */}
          <AttendanceCalendar courseId={resolvedCourseId} />
        </div>
      </div>
    </div>
  );
}
