import Sidebar from '../components/Sidebar';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API = 'https://codemedha-production-47c1.up.railway.app';
export default function CoursePage() {
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate  = useNavigate();
  const headers   = { Authorization: `Bearer ${token}` };
  const videoRef  = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [dailyClass,  setDailyClass]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [classStatus, setClassStatus] = useState('active');
  const [courseId,    setCourseId]    = useState(user?.enrolledCourse || null);
  const [alreadyOpened, setAlreadyOpened] = useState(false); // true = this trainee already opened this class
  const [attendanceDeadline, setAttendanceDeadline] = useState(null); // ISO string
  const [attStatus,   setAttStatus]   = useState('not_marked'); // trainee's attendance status

  // Activity tracking state
  const [activitySent, setActivitySent] = useState(false); // "opened" event sent
  const watchIntervalRef = useRef(null);
  const lastReportedRef  = useRef(0); // last watchedSeconds we sent to server

  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-fetch enrolledCourse if missing
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!courseId && user?._id) {
      api.get(`${API}/api/courses/${user._id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const list = res.data || [];
          if (list.length > 0) setCourseId(list[0]._id);
        }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (courseId) {
      loadTodayClass();
    } else {
      setLoading(false);
    }
  }, [courseId]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, []);

  // Real-time: listen for admin marking attendance
  useEffect(() => {
    if (!user) return;
    let s;
    try {
      const { io } = require('socket.io-client');
      s = io('', { transports: ['websocket'] });
      s.emit('join', { userId: user._id || user.id });
      s.on('attendance-update', (data) => {
        if (data.date === todayStr) {
          setAttStatus(data.status);
          // Fire browser notification
          if (Notification.permission === 'granted') {
            new Notification('✅ Attendance Marked!', {
              body: data.status === 'present'
                ? `Your attendance for ${data.date} has been marked Present. Keep it up! 🔥`
                : `Your attendance for ${data.date} has been marked Absent.`,
              icon: '/favicon.ico',
            });
          }
          window.dispatchEvent(new Event('attendance-marked'));
        }
      });
    } catch(e) {}
    return () => { try { s?.disconnect(); } catch(e) {} };
  }, [user, todayStr]);

  const loadTodayClass = async () => {
    try {
      setLoading(true);
      let res;
      try { res = await api.get(`${API}/api/classes/today/${courseId}`, { headers }); }
      catch { res = await api.get(`${API}/api/classes/today`, { headers }); }
      const cls = res.data;
      setDailyClass(cls);
      if (cls?.date) {
        const clsDate = cls.date.split('T')[0];
        if (clsDate < todayStr) setClassStatus('expired');
        else if (clsDate > todayStr) setClassStatus('upcoming');
        else setClassStatus('active');
      }

      // Fetch today's attendance status + deadline info
      try {
        const statusRes = await api.get(`${API}/api/attendance/today-status`, { headers });
        setAttendanceDeadline(statusRes.data.attendanceDeadline);
        setAttStatus(statusRes.data.status);
        setAlreadyOpened(statusRes.data.opened);

        // If already opened previously — do NOT send opened again, do NOT allow re-open
        if (statusRes.data.opened) {
          // Class was already opened before — just track watch time, don't re-trigger open
          return; // skip the sendActivity(opened: true) below
        }
      } catch (e) { /* non-critical */ }

      // First time opening this class — mark as opened
      if (cls && cls._id && cls.date?.split('T')[0] === todayStr) {
        sendActivity(cls._id, { opened: true });
        setAlreadyOpened(true);
      }
    } catch (err) {
      console.error('Failed to load class', err);
    } finally {
      setLoading(false);
    }
  };

  // Send activity data to server
  const sendActivity = async (classId, extra = {}) => {
    try {
      const vid = videoRef.current;
      const watchedSeconds = vid ? Math.floor(vid.currentTime) : 0;
      const classDuration  = vid && vid.duration && !isNaN(vid.duration) ? Math.floor(vid.duration) : 0;

      await api.post(`${API}/api/attendance/track-activity`, {
        classId,
        courseId,
        date: todayStr,
        watchedSeconds,
        classDuration,
        ...extra,
      }, { headers });
    } catch (e) {
      // Silently fail — don't interrupt student
    }
  };

  // When video starts playing — mark opened + start periodic reporting
  const handleVideoPlay = () => {
    if (!dailyClass?._id || classStatus !== 'active') return;

    if (!activitySent) {
      sendActivity(dailyClass._id, { opened: true });
      setActivitySent(true);
    }

    // Report progress every 15 seconds while playing
    if (!watchIntervalRef.current) {
      watchIntervalRef.current = setInterval(() => {
        const vid = videoRef.current;
        if (!vid) return;
        const watched = Math.floor(vid.currentTime);
        // Only send if meaningfully different from last report
        if (watched - lastReportedRef.current >= 10) {
          lastReportedRef.current = watched;
          sendActivity(dailyClass._id);
        }
      }, 15000);
    }
  };

  // Stop interval when paused
  const handleVideoPause = () => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
    // Send final progress on pause
    if (dailyClass?._id) sendActivity(dailyClass._id);
  };

  // Final report when video ends
  const handleVideoEnded = () => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
    if (dailyClass?._id) sendActivity(dailyClass._id);
  };

  const handleContextMenu = (e) => e.preventDefault();

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'a'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const navItems = [
    { icon: '⊞', label: 'Dashboard',     path: '/dashboard' },
    { icon: '📅', label: 'Attendance',    path: '/attendance' },
    { icon: '🎥', label: 'Classes',       path: '/courses', active: true },
    { icon: '📚', label: 'My Course',     path: '/my-course' },
    { icon: '📝', label: 'Assignments',   path: `/assignment/${todayStr}` },
    { icon: '🔔', label: 'Notifications', path: '/notifications' },
    { icon: '📊', label: 'Analytics',     path: '/analytics' },
    { icon: '🏆', label: 'Leaderboard',   path: '/leaderboard' },
    { icon: '👤', label: 'Profile',       path: '/profile' },
    { icon: '💬', label: 'Group Chat',    path: courseId ? `/chat/${courseId}` : '/courses' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.pageBg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <Sidebar activePath="/courses" courseId={user&&user.enrolledCourse} />
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '60px 12px 80px' : '24px', overflowY: 'auto', overflowX: 'hidden', background: theme.pageBg, boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0 }}>
          <h2 style={{ color: theme.textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>📺 Today's Class</h2>
          <button
            onClick={() => navigate('/my-course')}
            style={{ background: 'linear-gradient(135deg,#7c6af5,#00d4aa)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📚 View My Course
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 , minWidth: 0, overflow: "hidden"}}>
            <div style={{ width: 32, height: 32, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: theme.textMuted, marginTop: 12 }}>Loading class...</p>
          </div>
        ) : !dailyClass ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, overflow: "hidden", gap: 12 }}>
            <div style={{ fontSize: 48 }}>📅</div>
            <h3 style={{ fontSize: 20, color: theme.textPrimary, fontWeight: 700, margin: 0 }}>No class today</h3>
            <p style={{ fontSize: 14, color: theme.textMuted, margin: 0 }}>Today's class has not been uploaded yet. Check back later!</p>
          </div>
        ) : (
          <div style={{ flex: 1 , minWidth: 0, overflow: "hidden"}}>
            <div style={{ background: theme.cardBg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: 18, color: theme.textPrimary, fontWeight: 700, margin: '0 0 10px 0' }}>{dailyClass.title}</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, background: theme.hoverBg, color: theme.textSecondary, padding: '4px 12px', borderRadius: 20 }}>📅 {dailyClass.date}</span>
                  <span style={{ fontSize: 12, background: theme.hoverBg, color: theme.textSecondary, padding: '4px 12px', borderRadius: 20 }}>⏰ Expires at midnight</span>
                  {classStatus === 'active' && (
                    <span style={{ fontSize: 12, background: '#E1F5EE', color: '#1D9E75', padding: '4px 12px', borderRadius: 20 }}>🔴 Live now</span>
                  )}
                  <span style={{ fontSize: 12, background: '#ede9fe', color: '#7c6af5', padding: '4px 12px', borderRadius: 20 }}>
                    👁 Your watch time is being tracked for attendance
                  </span>
                  {courseId && (
                    <button onClick={() => navigate(`/chat/${courseId}`)}
                      style={{ fontSize: 12, background: 'linear-gradient(135deg,#7c6af520,#00d4aa20)', color: '#7c6af5', border: '1px solid #7c6af540', padding: '4px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      💬 Group Chat
                    </button>
                  )}
                </div>

                {/* ── Attendance Status Banner ── */}
                <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden' }}>
                  {attStatus === 'present' ? (
                    <div style={{ background: '#e6f7f2', border: '1.5px solid #1D9E75', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1D9E75', fontSize: 14 }}>Attendance Marked — Present</div>
                        <div style={{ fontSize: 12, color: '#555' }}>Your attendance for today has been confirmed. Great job! 🔥</div>
                      </div>
                    </div>
                  ) : attStatus === 'absent' ? (
                    <div style={{ background: '#fdecea', border: '1.5px solid #e74c3c', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>❌</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#e74c3c', fontSize: 14 }}>Attendance Marked — Absent</div>
                        <div style={{ fontSize: 12, color: '#555' }}>Your attendance was marked absent. Contact admin if this is incorrect.</div>
                      </div>
                    </div>
                  ) : attendanceDeadline ? (
                    (() => {
                      const deadlineDate = new Date(attendanceDeadline);
                      const isPast = new Date() > deadlineDate;
                      return (
                        <div style={{ background: isPast ? '#fff8e1' : '#f0f4ff', border: `1.5px solid ${isPast ? '#f5a623' : '#185FA5'}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{isPast ? '⌛' : '🕐'}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: isPast ? '#e67e22' : '#185FA5', fontSize: 14 }}>
                              {isPast ? 'Attendance Pending — Admin will mark soon' : 'Attendance Not Yet Marked'}
                            </div>
                            <div style={{ fontSize: 12, color: '#555' }}>
                              {isPast
                                ? `Deadline passed at ${deadlineDate.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Admin is reviewing attendance.`
                                : `Your attendance will be marked after ${deadlineDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Watch the full class!`}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📋</span>
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        <strong>Attendance not yet marked.</strong> Your watch time is being tracked. Admin will mark attendance after the class deadline.
                      </div>
                    </div>
                  )}
                </div>

                {/* Already opened warning */}
                {alreadyOpened && classStatus === 'active' && (
                  <div style={{ marginTop: 8, background: '#fff8e1', border: '1px solid #ffe0b2', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#e67e22' }}>
                    ℹ️ You already opened this class. Your first open time was recorded for attendance. Re-opening is tracked but only the first open counts.
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', background: '#000', userSelect: 'none' }} onContextMenu={handleContextMenu}>
                <div style={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, zIndex: 10, pointerEvents: 'none', letterSpacing: 1 }}>{user?.name} • {user?.email}</div>
                {classStatus === 'expired' ? (
                  <div style={{ width: '100%', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>This Class Has Expired</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 16, maxWidth: 300 }}>This class recording is no longer available for playback.</div>
                    <div style={{ background: '#ef444422', color: '#ef4444', fontSize: 12, fontWeight: 600, padding: '6px 18px', borderRadius: 8 }}>Please Contact Admin</div>
                  </div>
                ) : classStatus === 'upcoming' ? (
                  <div style={{ width: '100%', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔜</div>
                    <div style={{ color: '#f59e0b', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Class Not Yet Active</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, maxWidth: 300 }}>This class will be available on its scheduled date.</div>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
                    controls
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={handleContextMenu}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onEnded={handleVideoEnded}
                    src={`${API}/api/classes/stream/${dailyClass._id}`}>
                    Your browser does not support video.
                  </video>
                )}
              </div>
              <div style={{ padding: '12px 24px', background: isDark ? '#1a0a00' : '#FFF8E1', fontSize: 12, color: isDark ? '#f5a623' : '#E65100' }}>
                🔒 This video is protected. Downloading, screenshots, and screen recording are not permitted.
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}