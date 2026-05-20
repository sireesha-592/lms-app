import Sidebar from '../components/Sidebar';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API = 'https://codemedha-production-47c1.up.railway.app';
// Technology icon/color lookup
const TECH_STYLES = {
  'mongodb':    { color: '#13aa52', text: '#fff', icon: '🍃', desc: 'NoSQL Database' },
  'express':    { color: '#353535', text: '#fff', icon: '⚡', desc: 'Backend Framework' },
  'express.js': { color: '#353535', text: '#fff', icon: '⚡', desc: 'Backend Framework' },
  'react':      { color: '#20232a', text: '#61dafb', icon: '⚛️', desc: 'Frontend Library' },
  'react.js':   { color: '#20232a', text: '#61dafb', icon: '⚛️', desc: 'Frontend Library' },
  'node':       { color: '#026e00', text: '#fff', icon: '🟢', desc: 'Runtime Environment' },
  'node.js':    { color: '#026e00', text: '#fff', icon: '🟢', desc: 'Runtime Environment' },
  'javascript': { color: '#f7df1e', text: '#000', icon: '📜', desc: 'Programming Language' },
  'js':         { color: '#f7df1e', text: '#000', icon: '📜', desc: 'Programming Language' },
  'html':       { color: '#e34f26', text: '#fff', icon: '🌐', desc: 'Markup Language' },
  'html5':      { color: '#e34f26', text: '#fff', icon: '🌐', desc: 'Markup Language' },
  'css':        { color: '#264de4', text: '#fff', icon: '🎨', desc: 'Styling Language' },
  'css3':       { color: '#264de4', text: '#fff', icon: '🎨', desc: 'Styling Language' },
  'git':        { color: '#f05032', text: '#fff', icon: '🔀', desc: 'Version Control' },
  'github':     { color: '#24292e', text: '#fff', icon: '🐙', desc: 'Code Hosting' },
  'rest api':   { color: '#ff6b35', text: '#fff', icon: '🔗', desc: 'API Architecture' },
  'rest':       { color: '#ff6b35', text: '#fff', icon: '🔗', desc: 'API Architecture' },
  'api':        { color: '#ff6b35', text: '#fff', icon: '🔗', desc: 'API Architecture' },
  'jwt':        { color: '#d63aff', text: '#fff', icon: '🔐', desc: 'Authentication Tokens' },
  'socket.io':  { color: '#010101', text: '#fff', icon: '📡', desc: 'Real-time Communication' },
  'socket':     { color: '#010101', text: '#fff', icon: '📡', desc: 'Real-time Communication' },
  'vs code':    { color: '#007acc', text: '#fff', icon: '💻', desc: 'Code Editor' },
  'vscode':     { color: '#007acc', text: '#fff', icon: '💻', desc: 'Code Editor' },
  'typescript': { color: '#3178c6', text: '#fff', icon: '📘', desc: 'Typed JavaScript' },
  'python':     { color: '#3776ab', text: '#fff', icon: '🐍', desc: 'Programming Language' },
  'mysql':      { color: '#4479a1', text: '#fff', icon: '🐬', desc: 'Relational Database' },
  'postgresql': { color: '#336791', text: '#fff', icon: '🐘', desc: 'Relational Database' },
  'redux':      { color: '#764abc', text: '#fff', icon: '🔄', desc: 'State Management' },
  'docker':     { color: '#2496ed', text: '#fff', icon: '🐳', desc: 'Containerization' },
  'aws':        { color: '#ff9900', text: '#000', icon: '☁️', desc: 'Cloud Platform' },
  'firebase':   { color: '#ffca28', text: '#000', icon: '🔥', desc: 'Backend-as-a-Service' },
  'tailwind':   { color: '#06b6d4', text: '#fff', icon: '💨', desc: 'CSS Framework' },
  'bootstrap':  { color: '#7952b3', text: '#fff', icon: '🅱️', desc: 'CSS Framework' },
  'next.js':    { color: '#000000', text: '#fff', icon: '▲', desc: 'React Framework' },
  'nextjs':     { color: '#000000', text: '#fff', icon: '▲', desc: 'React Framework' },
  'graphql':    { color: '#e10098', text: '#fff', icon: '⬡', desc: 'Query Language' },
  'postman':    { color: '#ff6c37', text: '#fff', icon: '📮', desc: 'API Testing' },
  'linux':      { color: '#fcc624', text: '#000', icon: '🐧', desc: 'Operating System' },
  'npm':        { color: '#cb3837', text: '#fff', icon: '📦', desc: 'Package Manager' },
};

const FALLBACK_COLORS = [
  { color: '#6366f1', text: '#fff' }, { color: '#8b5cf6', text: '#fff' },
  { color: '#ec4899', text: '#fff' }, { color: '#14b8a6', text: '#fff' },
  { color: '#f59e0b', text: '#000' }, { color: '#10b981', text: '#fff' },
  { color: '#3b82f6', text: '#fff' }, { color: '#ef4444', text: '#fff' },
];

function getTechStyle(name, idx) {
  const key = name.toLowerCase().trim();
  return TECH_STYLES[key] || { ...FALLBACK_COLORS[idx % FALLBACK_COLORS.length], icon: '🔧', desc: 'Technology' };
}

const MERN_ROADMAP = [
  { phase: 'Phase 1', title: 'Web Fundamentals', weeks: 'Week 1–2', color: '#e34f26',
    topics: ['HTML5 — Semantic tags, Forms, Tables', 'CSS3 — Flexbox, Grid, Animations', 'Responsive Design — Media queries', 'JavaScript Basics — Variables, Loops, Functions'] },
  { phase: 'Phase 2', title: 'JavaScript Deep Dive', weeks: 'Week 3–4', color: '#f7df1e', textColor: '#000',
    topics: ['ES6+ — Arrow functions, Destructuring, Spread', 'Async JS — Promises, async/await', 'DOM Manipulation', 'Fetch API & JSON'] },
  { phase: 'Phase 3', title: 'React Frontend', weeks: 'Week 5–7', color: '#61dafb', textColor: '#000',
    topics: ['React Basics — JSX, Components, Props', 'State & Hooks — useState, useEffect, useContext', 'React Router — Navigation, Protected routes', 'Axios — API calls from React'] },
  { phase: 'Phase 4', title: 'Node.js & Express Backend', weeks: 'Week 8–10', color: '#68a063',
    topics: ['Node.js — Modules, File system, Events', 'Express.js — Routes, Middleware, REST APIs', 'JWT Authentication — Login, Signup, Token auth', 'File uploads — Multer'] },
  { phase: 'Phase 5', title: 'MongoDB Database', weeks: 'Week 11–12', color: '#13aa52',
    topics: ['MongoDB — CRUD operations, Queries', 'Mongoose — Schemas, Models, Validation', 'Relationships — Populate, References', 'Aggregation Pipeline'] },
  { phase: 'Phase 6', title: 'Full Stack Integration', weeks: 'Week 13–14', color: '#7c6af5',
    topics: ['Connect React ↔ Express ↔ MongoDB', 'Real-time features with Socket.IO', 'Deployment — Environment variables, Production build', 'Final Project — Complete MERN app'] },
];

export default function MyCourse() {
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [courseInfo,  setCourseInfo]  = useState(null);
  const [courseId,    setCourseId]    = useState(user?.enrolledCourse || null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activePhase, setActivePhase] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [availableCourses, setAvailableCourses] = useState([]);

  // Doubts state
  const [doubts,       setDoubts]       = useState([]);
  const [doubtQ,       setDoubtQ]       = useState('');
  const [doubtPri,     setDoubtPri]     = useState('medium');
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [doubtToast,   setDoubtToast]   = useState('');
  const [showDoubts,   setShowDoubts]   = useState(false);

  // Resources state
  const [resources,    setResources]    = useState([]);
  const [resLoading,   setResLoading]   = useState(false);
  const [showResources, setShowResources] = useState(false);

  // Session Notes state
  const [sessionNotes,  setSessionNotes]  = useState([]);
  const [notesLoading,  setNotesLoading]  = useState(false);
  const [showNotes,     setShowNotes]     = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    // Always fetch fresh user first to get latest enrolledCourse
    api.get(`${API}/api/auth/me`, { headers })
      .then(async res => {
        const freshUser = res.data;
        const resolvedId = freshUser?.enrolledCourse || courseId;
        if (resolvedId) {
          const courseRes = await api.get(`${API}/api/courses/id/${resolvedId}`, { headers });
          setCourseInfo(courseRes.data);
          setCourseId(resolvedId);
        } else {
          // fallback: fetch by studentId
          const listRes = await api.get(`${API}/api/courses/${freshUser?._id}`, { headers });
          const list = listRes.data || [];
          if (list.length > 0) { setCourseId(list[0]._id); setCourseInfo(list[0]); }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (token && !courseId && !user?.enrolledCourse) {
      api.get(`${API}/api/courses`, { headers })
        .then(res => setAvailableCourses(res.data || []))
        .catch(() => {});
    }
  }, [token, courseId, user]);

  // Load doubts submitted by this student
  const loadDoubts = useCallback(async () => {
    if (!courseId) return;
    setDoubtLoading(true);
    try {
      const res = await api.get(`${API}/api/doubts/mine?courseId=${courseId}`, { headers });
      setDoubts(res.data || []);
    } catch {}
    setDoubtLoading(false);
  }, [courseId, token]);

  // Load shared resources
  const loadResources = useCallback(async () => {
    if (!courseId) return;
    setResLoading(true);
    try {
      const res = await api.get(`${API}/api/resources?courseId=${courseId}`, { headers });
      setResources(res.data || []);
    } catch {}
    setResLoading(false);
  }, [courseId, token]);

  // Load shared session notes
  const loadNotes = useCallback(async () => {
    if (!courseId) return;
    setNotesLoading(true);
    try {
      const res = await api.get(`${API}/api/session-notes?courseId=${courseId}`, { headers });
      setSessionNotes(res.data || []);
    } catch {}
    setNotesLoading(false);
  }, [courseId, token]);

  useEffect(() => {
    if (showDoubts) loadDoubts();
  }, [showDoubts, loadDoubts]);

  useEffect(() => {
    if (showResources) loadResources();
  }, [showResources, loadResources]);

  useEffect(() => {
    if (showNotes) loadNotes();
  }, [showNotes, loadNotes]);

  const submitDoubt = async () => {
    if (!doubtQ.trim()) return;
    if (!courseId) return setDoubtToast('⚠️ Not enrolled in a course');
    try {
      const res = await api.post(`${API}/api/doubts`, { courseId, question: doubtQ.trim(), priority: doubtPri }, { headers });
      setDoubts(prev => [res.data, ...prev]);
      setDoubtQ(''); setDoubtPri('medium');
      setDoubtToast('✅ Doubt submitted! Trainer will resolve it.');
      setTimeout(() => setDoubtToast(''), 3000);
    } catch (e) {
      setDoubtToast('⚠️ ' + (e.response?.data?.message || 'Failed'));
      setTimeout(() => setDoubtToast(''), 3000);
    }
  };

  const adminTechs = courseInfo?.technologies?.filter(Boolean) || [];
  const hasTechs   = adminTechs.length > 0;
  const techList   = hasTechs ? adminTechs : ['MongoDB', 'Express.js', 'React', 'Node.js', 'JavaScript', 'HTML5', 'CSS3', 'Git', 'REST API', 'JWT', 'Socket.IO', 'VS Code'];

  const navItems = [
    { icon: '⊞', label: 'Dashboard',     path: '/dashboard' },
    { icon: '📅', label: 'Attendance',    path: '/attendance' },
    { icon: '🎥', label: 'Classes',       path: '/courses' },
    { icon: '📚', label: 'My Course',     path: '/my-course', active: true },
    { icon: '📝', label: 'Assignments',   path: `/assignment/${todayStr}` },
    { icon: '🔔', label: 'Notifications', path: '/notifications' },
    { icon: '📊', label: 'Analytics',     path: '/analytics' },
    { icon: '🏆', label: 'Leaderboard',   path: '/leaderboard' },
    { icon: '👤', label: 'Profile',       path: '/profile' },
    { icon: '💬', label: 'Group Chat',    path: courseId ? `/chat/${courseId}` : '/courses' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.pageBg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <Sidebar activePath="/my-course" courseId={user&&user.enrolledCourse} />

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', background: theme.pageBg, position: 'relative' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding: '40px 40px 40px', position: 'relative', zIndex: 0, flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #7c6af520, transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 100, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, #00d4aa15, transparent)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#7c6af5,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>⚡</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Your Enrolled Course</div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                {loading ? 'Loading...' : (courseInfo?.title || 'MERN Full Stack Development')}
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: '10px 0 0', maxWidth: 560, lineHeight: 1.6 }}>
                {!loading && (courseInfo?.description || 'Master the complete MERN stack — from HTML/CSS basics to building and deploying full-stack web applications with React, Node.js, Express, and MongoDB.')}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <span style={{ background: '#ffffff15', color: '#e2e8f0', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏱ 14 Weeks</span>
                <span style={{ background: '#ffffff15', color: '#e2e8f0', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>📦 6 Phases</span>
                <span style={{ background: '#ffffff15', color: '#e2e8f0', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>🛠 {techList.length} Technologies</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: isMobile ? '60px 12px 80px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: 28, position: 'relative', zIndex: 1, background: theme.pageBg, boxSizing: 'border-box' }}>

          {/* Not enrolled — show available courses */}
          {!loading && !courseInfo && !user?.enrolledCourse && (
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.textPrimary, marginBottom: 8 }}>You're not enrolled in any course yet</h2>
              <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 28 }}>Contact your admin to get enrolled. Here are the available courses:</p>
              {availableCourses.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, textAlign: 'left' }}>
                  {availableCourses.map(course => (
                    <div key={course._id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '20px 22px', borderLeft: '4px solid #7c6af5' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary, marginBottom: 8 }}>{course.title}</div>
                      {course.description && <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{course.description}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {(course.technologies || []).slice(0, 5).map((t, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '3px 10px', background: '#7c6af520', color: '#7c6af5', borderRadius: 20, fontWeight: 600 }}>{t}</span>
                        ))}
                        {(course.technologies || []).length > 5 && <span style={{ fontSize: 11, color: theme.textMuted }}>+{course.technologies.length - 5} more</span>}
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted }}>👥 {course.enrolledStudents?.length || 0} trainees enrolled</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: theme.textMuted, fontSize: 14 }}>No courses available at the moment.</p>
              )}
            </div>
          )}

          {/* Admin Syllabus — first priority */}
          {courseInfo && <>
          {courseInfo?.syllabus?.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>📋 Course Syllabus</div>
                <span style={{ background: '#7c6af520', color: '#7c6af5', border: '1px solid #7c6af540', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Set by Trainer</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {courseInfo.syllabus.map((s, i) => (
                  <div key={i} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', borderLeft: '3px solid #7c6af5' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c6af5', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.week || `Module ${i + 1}`}</div>
                    <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.5 }}>{s.topics}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Technologies */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>🛠 Technologies You Will Learn</div>
              {hasTechs
                ? <span style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Set by Admin</span>
                : <span style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Default Stack</span>
              }
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {techList.map((name, idx) => {
                const s = getTechStyle(name, idx);
                return (
                  <div key={name} style={{ background: s.color, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'transform 0.2s', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: s.text }}>{name}</div>
                      <div style={{ fontSize: 10, color: s.text, opacity: 0.75, marginTop: 1 }}>{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Roadmap */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>🗺️ Learning Roadmap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MERN_ROADMAP.map((phase, idx) => {
                const isOpen = activePhase === idx;
                return (
                  <div key={idx} style={{ background: theme.cardBg, border: `1px solid ${isOpen ? phase.color : theme.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button onClick={() => setActivePhase(isOpen ? null : idx)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: phase.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: phase.textColor || '#fff', flexShrink: 0 }}>{idx + 1}</div>
                      <div style={{ flex: 1 , minWidth: 0, overflow: "hidden"}}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>{phase.title}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{phase.phase} • {phase.weeks}</div>
                      </div>
                      <span style={{ fontSize: 12, color: theme.textMuted, background: theme.hoverBg, padding: '3px 10px', borderRadius: 10 }}>{phase.topics.length} topics</span>
                      <span style={{ fontSize: 16, color: theme.textMuted, marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${theme.border}`, padding: '14px 20px 18px 70px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {phase.topics.map((topic, ti) => (
                            <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: phase.color, marginTop: 6, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.5 }}>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Trainer Resources ── */}
          <section>
            <button onClick={() => setShowResources(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, cursor: 'pointer', marginBottom: showResources ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📚</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>Trainer Resources</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>Study materials shared by your trainer</div>
                </div>
                {resources.length > 0 && <span style={{ background: '#7c6af520', color: '#7c6af5', border: '1px solid #7c6af540', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{resources.length}</span>}
              </div>
              <span style={{ color: theme.textMuted }}>{showResources ? '▲' : '▼'}</span>
            </button>
            {showResources && (
              resLoading ? <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted }}>Loading…</div> :
              resources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div>No resources shared yet</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
                  {resources.map(r => {
                    const typeColors = { link: '#3b82f6', pdf: '#ef4444', video: '#a78bfa', note: '#10b981', tool: '#f59e0b' };
                    const typeIcons  = { link: '🔗', pdf: '📄', video: '🎥', note: '📝', tool: '🛠️' };
                    const color = typeColors[r.type] || '#64748b';
                    return (
                      <div key={r._id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ height: 3, background: color }} />
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{typeIcons[r.type]}</span>
                            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textPrimary }}>{r.title}</div>
                          </div>
                          {r.desc && <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>{r.desc}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {r.tag && <span style={{ fontSize: 10, fontWeight: 600, color: '#10b981', background: '#10b98115', borderRadius: 20, padding: '2px 8px' }}>{r.tag}</span>}
                            {r.url && (() => {
                              const fileUrl = r.url.startsWith('/uploads') ? `${r.url}` : r.url;
                              const isFile = r.url.startsWith('/uploads');
                              return (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                                  download={isFile ? (r.fileName || true) : undefined}
                                  style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#3b82f6', textDecoration: 'none', padding: '3px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                  {isFile ? '⬇️ Download' : 'Open ↗'}
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </section>

          {/* ── Session Notes from Trainer ── */}
          <section>
            <button onClick={() => setShowNotes(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, cursor: 'pointer', marginBottom: showNotes ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🗒️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>Session Notes</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>Class notes shared by your trainer</div>
                </div>
                {sessionNotes.length > 0 && <span style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{sessionNotes.length}</span>}
              </div>
              <span style={{ color: theme.textMuted }}>{showNotes ? '▲' : '▼'}</span>
            </button>
            {showNotes && (
              notesLoading ? <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted }}>Loading…</div> :
              sessionNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div>No session notes shared yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sessionNotes.map(n => {
                    const isOpen = !!expandedNotes[n._id];
                    const tagColors = ['#3b82f6','#10b981','#a78bfa','#f59e0b'];
                    return (
                    <div key={n._id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderLeft: '4px solid #10b981', borderRadius: '0 12px 12px 0', overflow: 'hidden' }}>
                      {/* Collapsed header */}
                      <div
                        onClick={() => setExpandedNotes(prev => ({ ...prev, [n._id]: !prev[n._id] }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{n.topic}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>{n.date}</div>
                        </div>
                        <span style={{ color: theme.textMuted, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                      {/* Expanded body */}
                      {isOpen && (
                        <div style={{ padding: '0 16px 14px 16px', borderTop: `1px solid ${theme.border}` }}>
                          {(n.tags || []).length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, marginBottom: 8 }}>
                              {n.tags.map((t, i) => {
                                const tc = tagColors[i % 4];
                                return <span key={t} style={{ fontSize: 10, fontWeight: 600, color: tc, background: `${tc}18`, borderRadius: 20, padding: '2px 8px' }}>{t}</span>;
                              })}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: (n.tags||[]).length > 0 ? 0 : 10 }}>{n.content}</div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )
            )}
          </section>

          {/* ── Ask a Doubt ── */}
          <section>
            {doubtToast && <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: '0 8px 32px rgba(16,185,129,0.4)' }}>{doubtToast}</div>}
            <button onClick={() => setShowDoubts(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, cursor: 'pointer', marginBottom: showDoubts ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>❓</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>Ask a Doubt</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>Submit questions — trainer will resolve them</div>
                </div>
                {doubts.filter(d => d.status === 'pending').length > 0 && (
                  <span style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {doubts.filter(d => d.status === 'pending').length} pending
                  </span>
                )}
              </div>
              <span style={{ color: theme.textMuted }}>{showDoubts ? '▲' : '▼'}</span>
            </button>
            {showDoubts && (
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 20 }}>
                {/* Submit form */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.textPrimary, marginBottom: 12 }}>💬 Submit a New Doubt</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <select value={doubtPri} onChange={e => setDoubtPri(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.textPrimary, fontSize: 12, outline: 'none', flexShrink: 0 }}>
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>
                  <textarea
                    value={doubtQ} onChange={e => setDoubtQ(e.target.value)} rows={3}
                    placeholder="Describe your doubt or question clearly…"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.textPrimary, fontSize: 13, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <button onClick={submitDoubt} disabled={!doubtQ.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: !doubtQ.trim() ? '#374151' : 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: !doubtQ.trim() ? 'not-allowed' : 'pointer' }}>
                    📤 Submit Doubt
                  </button>
                </div>

                {/* My doubts list */}
                {doubtLoading ? <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted }}>Loading…</div> : doubts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 13 }}>No doubts submitted yet</div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>My Submitted Doubts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {doubts.map(d => {
                        const pColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
                        const pColor = pColors[d.priority] || '#64748b';
                        return (
                          <div key={d._id} style={{ background: theme.pageBg, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${d.status === 'resolved' ? '#10b981' : pColor}`, borderRadius: '0 10px 10px 0', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: pColor, background: `${pColor}18`, borderRadius: 20, padding: '2px 8px' }}>{d.priority?.toUpperCase()}</span>
                              {d.status === 'resolved'
                                ? <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: '#10b98118', borderRadius: 20, padding: '2px 8px' }}>✅ RESOLVED</span>
                                : <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', borderRadius: 20, padding: '2px 8px' }}>⏳ PENDING</span>}
                              <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>{new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div style={{ fontSize: 13, color: theme.textPrimary, marginBottom: 6 }}>{d.question}</div>
                            {d.status === 'resolved' && d.answer && (
                              <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderLeft: '3px solid #10b981', borderRadius: '0 8px 8px 0' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>💡 Trainer's Answer</div>
                                <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>{d.answer}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section style={{ paddingBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/courses')}
                style={{ background: 'linear-gradient(135deg,#7c6af5,#00d4aa)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                🎥 Go to Today's Class
              </button>
              <button onClick={() => navigate(`/assignment/${todayStr}`)}
                style={{ background: theme.cardBg, color: theme.textPrimary, border: `1px solid ${theme.border}`, padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                📝 Today's Assignment
              </button>
              <button onClick={() => navigate('/analytics')}
                style={{ background: theme.cardBg, color: theme.textPrimary, border: `1px solid ${theme.border}`, padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                📊 My Progress
              </button>
            </div>
          </section>
          </>
          }
        </div>
      </div>
    </div>
  );
}