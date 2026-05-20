import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const API = 'https://codemedha-production-47c1.up.railway.app';
const Dashboard = () => {
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const [resolvedCourseId, setResolvedCourseId] = useState(user?.enrolledCourse || null);
  const [stats, setStats] = useState({ attendance: 0, present: 0, absent: 0, total: 0, streak: 0 });
  const [todayClass, setTodayClass] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [dailyFeedbacks, setDailyFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const [availableCourses, setAvailableCourses] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) fetchDashboardData(); };
    window.addEventListener('attendance-marked', handler);
    return () => window.removeEventListener('attendance-marked', handler);
  }, [user]);

  // Auto-resolve courseId if not in user object
  useEffect(() => {
    if (!resolvedCourseId && user?._id && token) {
      api.get(`${API}/api/courses/${user._id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { if (res.data?.length > 0) setResolvedCourseId(res.data[0]._id); })
        .catch(() => {});
    }
  }, [user, token]);

  // Fetch all available courses for not-enrolled trainees
  useEffect(() => {
    if (token) {
      api.get(`${API}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setAvailableCourses(res.data || []))
        .catch(() => {});
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const tok = token || localStorage.getItem('lms_token_student') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${tok}` };
      const courseId = user?.enrolledCourse || resolvedCourseId;

      const promises = [
        api.get(`${API}/api/attendance/stats`, { headers }),
        api.get(`${API}/api/submissions/all`, { headers }),
        api.get(`${API}/api/daily-feedback/trainee${courseId ? `?courseId=${courseId}` : ''}`, { headers }),
      ];
      if (courseId) {
        promises.push(api.get(`${API}/api/classes/today/${courseId}`, { headers }));
      }

      const [attRes, subRes, fbRes, classRes] = await Promise.allSettled(promises);

      if (attRes.status === 'fulfilled') {
        const d = attRes.value.data;
        setStats({
          attendance: d.attendancePercentage || 0,
          present: d.present || 0,
          absent: d.absent || 0,
          total: d.total || 0,
          streak: d.currentStreak || 0,
        });
      }

      if (subRes.status === 'fulfilled') {
        setSubmissions(subRes.value.data || []);
      }

      if (fbRes.status === 'fulfilled') {
        setDailyFeedbacks(fbRes.value.data || []);
      }

      if (classRes && classRes.status === 'fulfilled') {
        setTodayClass(classRes.value.data);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const todayDate = new Date().toISOString().split('T')[0];
  const validSubmissions = submissions.filter(s => s.date <= todayDate);
  const submitted = validSubmissions.filter(s => s.status === 'submitted').length;
  const pending   = validSubmissions.filter(s => s.status !== 'submitted').length;

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const formatDate = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const greetingIcon = () => {
    const h = time.getHours();
    if (h < 12) return '🌅';
    if (h < 17) return '☀️';
    return '🌙';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: theme.pageBg, gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading your dashboard...</p>
      </div>
    );
  }

  const s = {
    page: { display: 'flex', minHeight: '100vh', background: theme.pageBg, color: theme.textPrimary, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
    sidebar: { width: 220, background: theme.sidebarBg, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
    sidebarLogo: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 28px' },
    logoIcon: { width: 34, height: 34, background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 },
    logoText: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', color: theme.textPrimary },
    nav: { flex: 1, minWidth: 0, overflow: "hidden", display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
    navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'transparent', color: theme.navInactiveColor, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%' },
    navItemActive: { background: theme.navActiveBg, color: theme.navActiveColor },
    navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
    sidebarUser: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px', borderTop: `1px solid ${theme.border}`, marginTop: 'auto' },
    userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, color: '#fff' },
    userName: { fontSize: 13, fontWeight: 600, color: theme.textPrimary },
    userRole: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
    main: { flex: 1, minWidth: 0, overflow: "hidden", padding: isMobile ? '60px 12px 80px' : '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '100%', boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: 'fadeIn 0.5s ease', flexWrap: 'wrap', gap: 10 },
    greeting: { fontSize: isMobile ? 17 : 22, fontWeight: 700, color: theme.textPrimary, marginBottom: 4 },
    dateText: { fontSize: 13, color: theme.textMuted },
    headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
    clockContainer: { background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: isMobile ? '6px 10px' : '10px 18px' },
    clock: { fontSize: isMobile ? 14 : 20, fontWeight: 700, color: theme.accent, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 },
    // Theme toggle button
    toggleBtn: {
      background: theme.toggleBg,
      border: `1px solid ${theme.border}`,
      color: theme.textPrimary,
      borderRadius: 50,
      width: 44,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: 20,
      transition: 'all 0.3s',
      flexShrink: 0,
    },
    statsGrid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, animation: 'fadeIn 0.6s ease' },
    statCard: { background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: isMobile ? '14px' : '20px', position: 'relative', overflow: 'hidden', minWidth: 0 },
    statTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    statIcon: { fontSize: 22 },
    statDot: { width: 8, height: 8, borderRadius: '50%' },
    statValue: { fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 },
    statLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
    statSub: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
    bottomGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, animation: 'fadeIn 0.7s ease' },
    card: { background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 14, fontWeight: 600, color: theme.textSecondary },
    badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
    classCard: { display: 'flex', gap: 12, alignItems: 'flex-start' },
    classThumbnail: { width: 60, height: 48, background: isDark ? 'linear-gradient(135deg, #1e2535, #0d1118)' : 'linear-gradient(135deg, #e2e8f0, #f0f4f8)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${theme.border}` },
    playIcon: { fontSize: 18, color: theme.accent },
    classInfo: { flex: 1 , minWidth: 0, overflow: "hidden"},
    classTitle: { fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 4 },
    classMeta: { fontSize: 11, color: theme.textMuted, marginBottom: 10 },
    watchBtn: { background: 'linear-gradient(135deg, #00d4aa, #00b090)', border: 'none', color: '#000', fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8, cursor: 'pointer' },
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 6 },
    emptyIcon: { fontSize: 32, opacity: 0.4 },
    emptyText: { fontSize: 14, color: theme.textMuted, fontWeight: 500 },
    emptySubText: { fontSize: 12, color: theme.textMuted },
    assignmentList: { display: 'flex', flexDirection: 'column', gap: 10 },
    assignmentItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: theme.inputBg, borderRadius: 10, border: `1px solid ${theme.border}` },
    assignmentDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
    assignmentInfo: { flex: 1 , minWidth: 0, overflow: "hidden"},
    assignmentTitle: { fontSize: 13, color: theme.textPrimary, fontWeight: 500 },
    assignmentDue: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
    submitBtn: { background: 'transparent', border: `1px solid ${theme.accentPurple}44`, color: theme.accentPurple, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, cursor: 'pointer' },
    progressSection: { display: 'flex', alignItems: 'center', gap: 20 },
    progressCircleContainer: { flexShrink: 0 },
    progressStats: { display: 'flex', flexDirection: 'column', gap: 14 },
    progressItem: { display: 'flex', alignItems: 'center', gap: 10 },
    progressDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
    progressLabel: { fontSize: 11, color: theme.textMuted, marginBottom: 2 },
    progressVal: { fontSize: 14, fontWeight: 600, color: theme.textPrimary },
  };

  return (
    <div style={{...s.page, paddingTop: 56}}>
      <Navbar />
      <Sidebar activePath="/dashboard" courseId={resolvedCourseId} />

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <div style={s.greeting}>{greetingIcon()} {greeting()}, {user?.name?.split(' ')[0] || 'Student'}</div>
            <div style={s.dateText}>{formatDate(time)}</div>
          </div>
          <div style={s.headerRight}>
            {/* 🌙 Dark / Light toggle */}
            <button
              style={s.toggleBtn}
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <div style={s.clockContainer}>
              <div style={s.clock}>{formatTime(time)}</div>
            </div>
          </div>
        </header>

        <div style={s.statsGrid}>
          {[
            { label: 'Attendance', value: `${Math.round(stats.attendance)}%`, icon: '📅', color: theme.accent, sub: `${stats.present} present / ${stats.absent} absent` },
            { label: 'Assignments Done', value: submitted, icon: '✅', color: theme.accentPurple, sub: `${pending} pending` },
            { label: 'Day Streak', value: `${stats.streak}🔥`, icon: '⚡', color: theme.accentOrange, sub: 'Consecutive days' },
            { label: "Today's Class", value: todayClass ? 'Active' : 'No Class', icon: '🎥', color: todayClass ? theme.accent : theme.textMuted, sub: todayClass ? todayClass.title || 'Class available' : 'Check tomorrow' },
          ].map((stat, i) => (
            <div key={i} style={s.statCard}>
              <div style={s.statTop}>
                <span style={s.statIcon}>{stat.icon}</span>
                <div style={{ ...s.statDot, background: stat.color }}></div>
              </div>
              <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
              <div style={s.statSub}>{stat.sub}</div>
            </div>
          ))}
        </div>

        <div style={s.bottomGrid}>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardTitle}>📺 Today's Class</span>
              <span style={{ ...s.badge, background: todayClass ? '#00d4aa22' : `${theme.border}22`, color: theme.accent, border: `1px solid ${theme.accent}44` }}>
                {todayClass ? 'Live' : 'No Class'}
              </span>
            </div>
            {todayClass ? (
              <div style={s.classCard}>
                <div style={s.classThumbnail}><div style={s.playIcon}>▶</div></div>
                <div style={s.classInfo}>
                  <div style={s.classTitle}>{todayClass.title || "Today's Session"}</div>
                  <div style={s.classMeta}>📆 {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} &nbsp;•&nbsp; 🕐 Access until midnight</div>
                  <button style={s.watchBtn} onClick={() => navigate('/courses')}>▶ Watch Now</button>
                </div>
              </div>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>🎥</div>
                <div style={s.emptyText}>No class scheduled for today</div>
                <div style={s.emptySubText}>Check back tomorrow</div>
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardTitle}>📝 Today's Assignment</span>
              <span style={{ ...s.badge, background: `${theme.accentPurple}22`, color: theme.accentPurple, border: `1px solid ${theme.accentPurple}44` }}>{validSubmissions.length} total</span>
            </div>
            {validSubmissions.length > 0 ? (
              <div style={s.assignmentList}>
                {validSubmissions.slice(0, 3).map((sub, i) => {
                  const totalAnswered = (sub.secA?.answered || 0) + (sub.secB?.answered || 0) + (sub.secC?.answered || 0);
                  const totalQ = (sub.secA?.total || 20) + (sub.secB?.total || 20) + (sub.secC?.total || 10);
                  const autoScore = (sub.secA?.score||0)+(sub.secB?.score||0)+(sub.secC?.score||0);
                  const displayScore = sub.scorePublished && sub.manualScore != null ? sub.manualScore : autoScore;
                  const maxScore = sub.maxScore || 100;
                  const isGraded = sub.scorePublished && sub.manualScore != null;
                  return (
                    <div key={i} style={s.assignmentItem}>
                      <div style={{ ...s.assignmentDot, background: sub.status === 'submitted' ? (isGraded ? '#10b981' : theme.accent) : theme.accentOrange }}></div>
                      <div style={s.assignmentInfo}>
                        <div style={s.assignmentTitle}>Assignment — {sub.date}</div>
                        <div style={s.assignmentDue}>
                          {sub.status === 'submitted'
                            ? isGraded
                              ? <span style={{ color: '#10b981', fontWeight: 600 }}>🏆 Graded • Score: {displayScore}/{maxScore}</span>
                              : <span>✅ Submitted • Awaiting grade</span>
                            : `📝 ${totalAnswered}/${totalQ} answered`
                          }
                        </div>
                      </div>
                      {sub.status !== 'submitted' && (
                        <button style={s.submitBtn} onClick={() => navigate(`/assignment/${sub.date}`)}>Continue →</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>📝</div>
                <div style={s.emptyText}>No assignments yet</div>
                <button style={{ ...s.submitBtn, marginTop: 8 }} onClick={() => navigate(`/assignment/${todayDate}`)}>Start Today's Assignment</button>
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}><span style={s.cardTitle}>📊 Attendance Overview</span></div>
            <div style={s.progressSection}>
              <div style={s.progressCircleContainer}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke={theme.border} strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={theme.accent} strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - stats.attendance / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }} />
                  <text x="60" y="55" textAnchor="middle" fill={theme.textPrimary} fontSize="20" fontWeight="bold">{Math.round(stats.attendance)}%</text>
                  <text x="60" y="72" textAnchor="middle" fill={theme.textMuted} fontSize="10">Attendance</text>
                </svg>
              </div>
              <div style={s.progressStats}>
                {[
                  { label: 'Present', val: `${stats.present} days`, color: theme.accent },
                  { label: 'Absent',  val: `${stats.absent} days`,  color: theme.accentRed },
                  { label: 'Streak',  val: `${stats.streak} days 🔥`, color: theme.accentOrange },
                ].map((p, i) => (
                  <div key={i} style={s.progressItem}>
                    <div style={{ ...s.progressDot, background: p.color }}></div>
                    <div>
                      <div style={s.progressLabel}>{p.label}</div>
                      <div style={s.progressVal}>{p.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── DAILY FEEDBACK FROM ADMIN ──────────────────────── */}
        {dailyFeedbacks.length > 0 && (
          <div style={{ padding: isMobile ? 0 : '0 0 24px', maxWidth: 900, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderRadius: 16, padding: 20, border: '1px solid #2a2a4a' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#e0e0e0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⭐ Daily Feedback from Admin
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {dailyFeedbacks.slice(0, 5).map((fb, i) => (
                  <div key={fb._id || i} style={{ background: '#0f0f1e', borderRadius: 10, padding: 14, borderLeft: '3px solid #7b61ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>📅 {fb.date}</span>
                      {fb.rating && (
                        <span style={{ fontSize: 12, color: '#f5a623' }}>{'⭐'.repeat(fb.rating)} ({fb.rating}/5)</span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.5, margin: 0 }}>{fb.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AVAILABLE COURSES (shown when not enrolled OR always) ─── */}
        {availableCourses.filter(c => c._id !== resolvedCourseId).length > 0 && !resolvedCourseId && (
          <div style={{ padding: isMobile ? 0 : '0 0 24px', maxWidth: 900, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ background: theme.cardBg, borderRadius: 16, padding: 20, border: `1px solid ${theme.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: theme.textPrimary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                📚 Available Courses
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {availableCourses.map(course => (
                  <div key={course._id} style={{ background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '16px 18px', borderLeft: '3px solid #7c6af5' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary, marginBottom: 6 }}>{course.title}</div>
                    {course.description && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{course.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {(course.technologies || []).slice(0, 4).map((t, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '2px 8px', background: '#7c6af520', color: '#7c6af5', borderRadius: 20, fontWeight: 600 }}>{t}</span>
                      ))}
                      {(course.technologies || []).length > 4 && <span style={{ fontSize: 11, color: theme.textMuted }}>+{course.technologies.length - 4} more</span>}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>
                      👥 {course.enrolledStudents?.length || 0} trainees enrolled
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 12 }}>Contact admin to get enrolled in a course.</p>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${theme.pageBg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
      `}</style>
    </div>
  );
};

export default Dashboard;