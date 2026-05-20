import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';

const API        = 'https://codemedha-production-47c1.up.railway.app';
const SOCKET_URL = 'https://codemedha-production-47c1.up.railway.app';

const SECTIONS = [
  { key: 'A', label: 'Section A', desc: 'Easy',   marks: 1, color: '#1D9E75', light: '#e6f7f2', count: 20 },
  { key: 'B', label: 'Section B', desc: 'Medium',  marks: 3, color: '#185FA5', light: '#e6f0fb', count: 20 },
  { key: 'C', label: 'Section C', desc: 'Hard',    marks: 5, color: '#534AB7', light: '#eeedfa', count: 10 },
];

// ── visibility helpers ────────────────────────────────────────
const VIS_OPTIONS = [
  { value: 'everyone', label: '🌐 Everyone',     desc: 'All students + trainer + admin' },
  { value: 'trainer',  label: '👨‍🏫 Trainer only', desc: 'Only trainer & admin see this'  },
  { value: 'admin',    label: '🔒 Admin only',    desc: 'Only admin sees this'            },
];

const roleColor = (role) =>
  role === 'admin' ? '#e74c3c' : role === 'trainer' || role === 'teacher' ? '#8e44ad' : '#2980b9';

const canSee = (msg, user) => {
  if (!user) return false;
  const role = user.role || 'student';
  const uid  = (user._id || user.id)?.toString();
  if (role === 'admin') return true;
  if (msg.visibility === 'everyone') return true;
  if (msg.visibility === 'trainer' && (role === 'teacher' || role === 'trainer')) return true;
  if ((msg.visibility === 'trainer' || msg.visibility === 'admin') && msg.senderId?.toString() === uid) return true;
  return false;
};

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });


// ── Inline Code Answer Viewer (used inside Submissions tab for Section C) ──
function CodeAnswerInline({ questionId, date, traineeId, token }) {
  const [data,      setData]      = React.useState(null);
  const [loading,   setLoading]   = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('html');

  React.useEffect(() => {
    if (!questionId || !date) { setLoading(false); return; }
    api.get(`${API}/api/code-answers/admin-trainee/${questionId}/${date}/${traineeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [questionId, date, traineeId]);

  const TAB_COLORS = { html: '#e44d26', css: '#264de4', javascript: '#f7df1e', react: '#61dafb' };
  const TAB_LABELS = { html: '🌐 HTML', css: '🎨 CSS', javascript: '⚡ JS', react: '⚛️ React' };

  if (loading) return (
    <div style={{ marginTop: 8, padding: '10px 14px', background: '#1e1e2e', borderRadius: 8, fontSize: 12, color: '#64748b'  }}>
      Loading code answer...
    </div>
  );
  if (!data) return (
    <div style={{ marginTop: 8, padding: '10px 14px', background: '#1e1e2e', borderRadius: 8, fontSize: 12, color: '#94a3b8' , fontStyle: 'italic' }}>
      💻 No code answer submitted for this question.
    </div>
  );

  const code    = data.code || {};
  const hasCode = Object.values(code).some(v => v && v.trim().length > 0);

  return (
    <div style={{ marginTop: 10, border: '1px solid #2a2a3e', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#181825' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>💻 Code Answer</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: data.status === 'submitted' ? '#1D9E7520' : '#f5a62320', color: data.status === 'submitted' ? '#1D9E75' : '#f5a623' }}>
          {data.status === 'submitted' ? '✅ Submitted' : '⏳ Draft'}
        </span>
      </div>
      <div style={{ display: 'flex', background: '#11111b', borderBottom: '1px solid #2a2a3e' }}>
        {['html','css','javascript','react'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '7px 0', border: 'none', background: activeTab === tab ? '#1e1e2e' : 'transparent', color: activeTab === tab ? TAB_COLORS[tab] : '#444', fontSize: 11, fontWeight: activeTab === tab ? 700 : 400, cursor: 'pointer', borderBottom: activeTab === tab ? `2px solid ${TAB_COLORS[tab]}` : '2px solid transparent' }}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {hasCode ? (
        <pre style={{ margin: 0, padding: '12px 14px', background: '#1e1e2e', color: '#cdd6f4', fontSize: 12, lineHeight: 1.6, fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace", overflowX: 'auto', maxHeight: 250, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {code[activeTab] || `// No ${activeTab} code written`}
        </pre>
      ) : (
        <div style={{ padding: '12px 14px', background: '#1e1e2e', color: '#444', fontSize: 12, fontStyle: 'italic' }}>
          // No code written yet
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ════════════════════════════════════════════════════════════

function AdminDashboard({ token, T, user }) {
  const [stats, setStats] = React.useState({ students:0, trainers:0, onlineNow:0 });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening';

  React.useEffect(() => {
    const h = { Authorization: 'Bearer '+token };
    fetch('https://codemedha-production.up.railway.app/api/auth/admin-stats', {headers:h})
      .then(r=>r.json())
      .then(d => setStats({ students: d.students||0, trainers: d.trainers||0, onlineNow: d.onlineNow||0 }))
      .catch(()=>{});
  }, [token]);

  const cards = [
    { icon:'👥', label:'Total Students', value:stats.students, color:'#6366f1', bg:'#6366f120' },
    { icon:'👨‍💻', label:'Total Trainers', value:stats.trainers, color:'#8b5cf6', bg:'#8b5cf620' },
    { icon:'🟢', label:'Online Now', value:stats.onlineNow, color:'#10b981', bg:'#10b98120' },
  ];

  return (
    <div style={{padding:8}}>
      {/* Welcome Banner */}
      <div style={{
        background:'linear-gradient(135deg, #1e3a5f 0%, #0f2027 50%, #1a1a3e 100%)',
        borderRadius:20, padding:'20px 16px', marginBottom:20,
        border:'1px solid #2a2a5e', position:'relative', overflow:'hidden'
      }}>
        <div style={{position:'absolute',top:-40,right:-40,width:200,height:200,
          borderRadius:'50%',background:'#6366f110'}}/>
        <div style={{position:'absolute',bottom:-60,right:80,width:150,height:150,
          borderRadius:'50%',background:'#8b5cf608'}}/>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontSize:13,color:'#94a3b8',fontWeight:600,marginBottom:6,letterSpacing:'1px',textTransform:'uppercase'}}>
            {greeting}
          </div>
          <h1 style={{fontSize:28,fontWeight:900,color:'#fff',margin:'0 0 8px',lineHeight:1.2}}>
            Welcome back, <span style={{color:'#818cf8'}}>{user?.name || 'Admin'}</span> 👑
          </h1>
          <p style={{fontSize:14,color:'#64748b',margin:0}}>
            Here's what's happening at CodeMedha today — {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:20,marginBottom:28}}>
        {cards.map(card=>(
          <div key={card.label} style={{
            background:T.card, border:'1px solid '+T.border,
            borderRadius:16, padding:24,
            display:'flex', alignItems:'center', gap:16,
            transition:'transform 0.2s'
          }}>
            <div style={{
              width:56, height:56, borderRadius:14,
              background:card.bg, display:'flex',
              alignItems:'center', justifyContent:'center', fontSize:26
            }}>{card.icon}</div>
            <div>
              <div style={{fontSize:30,fontWeight:900,color:card.color,lineHeight:1}}>{card.value}</div>
              <div style={{fontSize:13,color:T.muted,fontWeight:600,marginTop:4}}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{background:T.card,border:'1px solid '+T.border,borderRadius:16,padding:24}}>
        <h3 style={{color:T.text,fontWeight:800,fontSize:16,margin:'0 0 16px'}}>⚡ Quick Actions</h3>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          {[
            {label:'📝 Add Questions', color:'#6366f1'},
            {label:'📋 View Attendance', color:'#10b981'},
            {label:'📬 Check Submissions', color:'#f59e0b'},
            {label:'📊 Reports', color:'#8b5cf6'},
            {label:'🕐 Login Tracker', color:'#06b6d4'},
          ].map(a=>(
            <div key={a.label} style={{
              padding:'10px 18px', borderRadius:10,
              background:a.color+'20', color:a.color,
              fontWeight:700, fontSize:13, cursor:'pointer',
              border:'1px solid '+a.color+'40'
            }}>{a.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { token, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const headers = { Authorization: `Bearer ${token}` };

  // Theme-aware colours
  const T = {
    bg:       isDark ? '#0f0f1a' : '#f0f4f8',
    sidebar:  isDark ? '#13131f' : '#1e3a5f',
    card:     isDark ? '#1a1a2e' : '#ffffff',
    border:   isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#1e293b',
    textSub:  isDark ? '#94a3b8' : '#64748b',
    textMuted:isDark ? '#64748b' : '#94a3b8',
    input:    isDark ? '#0f0f1a' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    rowHover: isDark ? '#1e1e35' : '#f4f6fb',
    accent:   '#1e3a5f',
    accentBg: isDark ? 'rgba(30,58,95,0.3)' : '#e6f0fb',
  };

  const [tab, setTab]             = useState('questions');
  const [courseId, setCourseId]   = useState('');
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [questions, setQuestions] = useState([]);
  const [activeSection, setActiveSection] = useState('A');

  // ── Deadline state ────────────────────────────────────────────
  // deadlineInput: local datetime-local string (for the input element, in local time)
  // savedDeadline: ISO string from DB (null = midnight fallback)
  const [deadlineInput,  setDeadlineInput]  = useState('');   // "2025-05-15T18:30"
  const [savedDeadline,  setSavedDeadline]  = useState(null); // ISO or null
  const [deadlineSaving, setDeadlineSaving] = useState(false);
  const [deadlineMsg,    setDeadlineMsg]    = useState('');

  const emptyRows = (sec) => {
    const s = SECTIONS.find(x => x.key === sec);
    return Array.from({ length: s.count }, (_, i) => ({ text: '', marks: s.marks, order: i + 1 }));
  };
  const [secInputs, setSecInputs] = useState({ A: emptyRows('A'), B: emptyRows('B'), C: emptyRows('C') });
  const [saving,  setSaving]  = useState({ A: false, B: false, C: false });
  const [saveMsg, setSaveMsg] = useState({ A: '', B: '', C: '' });

  const [videoFile,  setVideoFile]  = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoAttDeadline, setVideoAttDeadline] = useState(''); // attendance deadline for video upload
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState('');

  // ── Attendance tab state ──────────────────────────────────────
  const [attDate,       setAttDate]       = useState(new Date().toISOString().split('T')[0]);
  const [attRows,       setAttRows]       = useState([]); // [{student, status, classActivity}]
  const [attLoading,    setAttLoading]    = useState(false);
  const [attSaving,     setAttSaving]     = useState({});
  const [attMsg,        setAttMsg]        = useState('');
  const [attClassInfo,  setAttClassInfo]  = useState(null); // DailyClass for that date
  const [attDeadlineInput, setAttDeadlineInput] = useState('');
  const [attDeadlineSaving, setAttDeadlineSaving] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [subLoading,  setSubLoading]  = useState(false);
  const [filterDate,  setFilterDate]  = useState(new Date().toISOString().split('T')[0]);
  const [expandedSub, setExpandedSub] = useState(null);
  const [expandedSec, setExpandedSec] = useState('A');

  // ── Daily Feedback state ─────────────────────────────────────
  const [fbDate,       setFbDate]       = useState(new Date().toISOString().split('T')[0]);
  const [fbCourseId,   setFbCourseId]   = useState('');
  const [fbTrainees,   setFbTrainees]   = useState([]);
  const [fbLoading,    setFbLoading]    = useState(false);
  const [fbSaving,     setFbSaving]     = useState(false);
  const [fbMsg,        setFbMsg]        = useState('');
  const [fbEdits,      setFbEdits]      = useState({}); // { traineeId: { feedback, rating } }

  // ── Course Info Management state ──────────────────────────
  const [ciCourses,     setCiCourses]     = useState([]);
  const [ciSelected,    setCiSelected]    = useState('');
  const [ciTitle,       setCiTitle]       = useState('');
  const [ciDesc,        setCiDesc]        = useState('');
  const [ciTechList,    setCiTechList]    = useState([]);
  const [ciTechInput,   setCiTechInput]   = useState('');
  const [ciSyllabus,    setCiSyllabus]    = useState([{ week: '', topics: '' }]);
  const [ciSaving,      setCiSaving]      = useState(false);
  const [ciMsg,         setCiMsg]         = useState('');
  const [ciNewName,     setCiNewName]     = useState('');
  const [ciCreating,    setCiCreating]    = useState(false);
  const [ciShowCreate,  setCiShowCreate]  = useState(false);
  const [ciTrainees,    setCiTrainees]    = useState([]);
  const [ciEnrolled,    setCiEnrolled]    = useState([]);
  const [ciEnrollMsg,   setCiEnrollMsg]   = useState('');

  const loadCiCourses = async () => {
    try {
      const res = await api.get(`${API}/api/courses`, { headers });
      setCiCourses(res.data || []);
    } catch (e) {}
  };

  const loadCiTrainees = async () => {
    try {
      const res = await api.get(`${API}/api/trainer/students`, { headers });
      setCiTrainees(res.data || []);
    } catch (e) {}
  };

  const selectCiCourse = (cid) => {
    setCiSelected(cid);
    setCiMsg(''); setCiEnrollMsg('');
    const c = ciCourses.find(x => x._id === cid);
    if (c) {
      setCiTitle(c.title || '');
      setCiDesc(c.description || '');
      setCiTechList(c.technologies?.filter(Boolean) || []);
      setCiTechInput('');
      setCiSyllabus(c.syllabus?.length ? c.syllabus : [{ week: '', topics: '' }]);
      setCiEnrolled(c.enrolledStudents?.map(s => s._id || s) || []);
    }
  };

  const addTech = () => {
    const val = ciTechInput.trim();
    if (!val) return;
    const parts = val.split(',').map(t => t.trim()).filter(Boolean);
    setCiTechList(prev => [...prev, ...parts.filter(p => !prev.includes(p))]);
    setCiTechInput('');
  };

  const removeTech = (tech) => setCiTechList(prev => prev.filter(t => t !== tech));

  const saveCiCourse = async () => {
    if (!ciSelected) return;
    try {
      setCiSaving(true); setCiMsg('');
      const syllabus = ciSyllabus.filter(s => s.week || s.topics);
      await api.put(`${API}/api/courses/${ciSelected}`, { title: ciTitle, description: ciDesc, technologies: ciTechList, syllabus }, { headers });
      await loadCiCourses();
      setCiMsg('✅ Course info saved!');
    } catch (e) { setCiMsg('❌ Failed to save: ' + (e.response?.data?.message || e.message)); }
    finally { setCiSaving(false); }
  };

  const createNewCourse = async () => {
    if (!ciNewName.trim()) return;
    try {
      setCiCreating(true);
      const res = await api.post(`${API}/api/courses`, { title: ciNewName.trim() }, { headers });
      const newCourse = res.data;
      setCiShowCreate(false); setCiNewName('');
      await loadCiCourses();
      // Set fields directly from response — don't depend on stale ciCourses state
      setCiSelected(newCourse._id);
      setCiTitle(newCourse.title || '');
      setCiDesc(newCourse.description || '');
      setCiTechList(newCourse.technologies?.filter(Boolean) || []);
      setCiSyllabus(newCourse.syllabus?.length ? newCourse.syllabus : [{ week: '', topics: '' }]);
      setCiEnrolled(newCourse.enrolledStudents?.map(s => s._id || s) || []);
      setCiMsg(''); setCiEnrollMsg('');
    } catch (e) { setCiMsg('❌ Failed to create: ' + (e.response?.data?.message || e.message)); }
    finally { setCiCreating(false); }
  };

  const deleteCiCourse = async () => {
    if (!ciSelected) return;
    const course = ciCourses.find(c => c._id === ciSelected);
    if (!window.confirm('Delete course "' + course?.title + '"? This cannot be undone.')) return;
    try {
      await api.delete(`${API}/api/courses/${ciSelected}`, { headers });
      setCiSelected(''); setCiTitle(''); setCiDesc(''); setCiTechList([]); setCiSyllabus([{ week: '', topics: '' }]);
      await loadCiCourses();
    } catch (e) { alert('Delete failed — add DELETE route to courses.js backend.'); }
  };

  const toggleEnroll = async (traineeId) => {
    const isEnrolled = ciEnrolled.includes(traineeId);
    try {
      setCiEnrollMsg('');
      await api.put(`${API}/api/auth/enroll`, { userId: traineeId, courseId: isEnrolled ? null : ciSelected }, { headers });
      setCiEnrolled(prev => isEnrolled ? prev.filter(id => id !== traineeId) : [...prev, traineeId]);
      await loadCiCourses();
      setCiEnrollMsg('✅ Updated!');
    } catch (e) { setCiEnrollMsg('❌ Failed to update enrollment.'); }
  };

  useEffect(() => { if (tab === 'courseinfo') { loadCiCourses(); loadCiTrainees(); } }, [tab]);

  useEffect(() => { if (courseId && date) loadQuestions(); }, [courseId, date]);

  // Helper: convert ISO UTC → "YYYY-MM-DDTHH:mm" in local time for datetime-local input
  const isoToLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const loadQuestions = async () => {
    try {
      const res = await api.get(`${API}/api/questions/${courseId}/${date}`, { headers });
      // Backend returns { questions, deadline } OR legacy array
      const raw = res.data;
      const qs = Array.isArray(raw) ? raw : (raw?.questions || []);
      const deadline = Array.isArray(raw) ? null : (raw?.deadline || null);
      setQuestions(qs);
      setSavedDeadline(deadline);
      setDeadlineInput(isoToLocalInput(deadline));
      const newInputs = { A: emptyRows('A'), B: emptyRows('B'), C: emptyRows('C') };
      qs.forEach(q => {
        const idx = (q.order || 1) - 1;
        if (newInputs[q.section] && idx >= 0 && idx < newInputs[q.section].length)
          newInputs[q.section][idx] = { text: q.text, marks: q.marks, order: q.order || idx + 1, _id: q._id };
      });
      setSecInputs(newInputs);
    } catch (err) { console.error(err); }
  };

  const updateRow = (sec, idx, field, value) =>
    setSecInputs(prev => {
      const updated = [...prev[sec]];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [sec]: updated };
    });

  const addRow    = (sec) => setSecInputs(prev => ({ ...prev, [sec]: [...prev[sec], { text: '', marks: SECTIONS.find(s => s.key === sec).marks, order: prev[sec].length + 1 }] }));
  const removeRow = (sec, idx) => setSecInputs(prev => { const r = [...prev[sec]]; r.splice(idx, 1); return { ...prev, [sec]: r }; });

  const saveSection = async (sec) => {
    if (!courseId) return alert('Please enter Course ID first!');
    const rows = secInputs[sec].filter(r => r.text.trim());
    if (!rows.length) return alert('Enter at least one question!');
    setSaving(p => ({ ...p, [sec]: true }));
    setSaveMsg(p => ({ ...p, [sec]: '' }));
    try {
      await Promise.all(questions.filter(q => q.section === sec).map(q => api.delete(`${API}/api/questions/${q._id}`, { headers }).catch(() => {})));
      await Promise.all(rows.map((r, i) => api.post(`${API}/api/questions`, { courseId, date, section: sec, text: r.text.trim(), marks: Number(r.marks), order: r.order || i + 1 }, { headers })));
      setSaveMsg(p => ({ ...p, [sec]: `✅ ${rows.length} questions saved!` }));
      loadQuestions();
    } catch (err) { setSaveMsg(p => ({ ...p, [sec]: '❌ Error: ' + err.message })); }
    finally { setSaving(p => ({ ...p, [sec]: false })); }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.delete(`${API}/api/questions/${id}`, { headers }); loadQuestions(); }
    catch { alert('Error deleting'); }
  };

  // ── Save deadline ─────────────────────────────────────────────
  const saveDeadline = async () => {
    if (!courseId) return alert('Please enter Course ID first!');
    setDeadlineSaving(true);
    setDeadlineMsg('');
    try {
      // deadlineInput is local datetime-local string → convert to ISO UTC
      const deadlineISO = deadlineInput ? new Date(deadlineInput).toISOString() : null;
      await api.put(`${API}/api/questions/deadline/${courseId}/${date}`, { deadline: deadlineISO }, { headers });
      setSavedDeadline(deadlineISO);
      setDeadlineMsg(deadlineISO
        ? `✅ Deadline set: ${new Date(deadlineISO).toLocaleString('en-IN')}`
        : '✅ Deadline reset to midnight (default)');
    } catch (err) { setDeadlineMsg('❌ Error: ' + err.message); }
    finally { setDeadlineSaving(false); }
  };

  const uploadVideo = async () => {
    if (!videoFile || !courseId || !videoTitle) return alert('Course ID, title, and video file required!');
    setUploading(true); setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('video', videoFile); fd.append('courseId', courseId);
      fd.append('date', date);       fd.append('title', videoTitle);
      if (videoAttDeadline) fd.append('attendanceDeadline', new Date(videoAttDeadline).toISOString());
      await api.post(`${API}/api/classes/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setUploadMsg('✅ Video uploaded successfully! Previous class expired.');
      setVideoFile(null); setVideoTitle(''); setVideoAttDeadline('');
    } catch (err) { setUploadMsg('❌ Upload failed: ' + err.message); }
    finally { setUploading(false); }
  };
  const resetSubmission = async (sub) => {
    if (!window.confirm(`Reopen submission for ${sub.trainee?.name}?`)) return;
    try {
      await api.patch(`${API}/api/submissions/reset`, { traineeId: sub.traineeId, date: sub.date }, { headers });
      loadSubmissions();
      alert('✅ Submission reopened!');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const deleteSubmission = async (sub) => {
    if (!window.confirm(`⚠️ DELETE submission for ${sub.trainee?.name} on ${sub.date}?\n\nThis cannot be undone!`)) return;
    try {
      await api.delete(`${API}/api/submissions/${sub.traineeId}/${sub.date}`, { headers });
      loadSubmissions();
      alert('🗑️ Submission deleted.');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const publishSubmission = async (sub, adminFeedback = '') => {
    try {
      await api.patch(`${API}/api/submissions/publish`, { traineeId: sub.traineeId, date: sub.date, adminFeedback }, { headers });
      loadSubmissions();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const unpublishSubmission = async (sub) => {
    if (!window.confirm(`Hide score from ${sub.trainee?.name}?`)) return;
    try {
      await api.patch(`${API}/api/submissions/unpublish`, { traineeId: sub.traineeId, date: sub.date }, { headers });
      loadSubmissions();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const loadSubmissions = async () => {
    setSubLoading(true);
    try {
      const params = filterDate ? `?date=${filterDate}` : '';
      const res = await api.get(`${API}/api/submissions/admin/all${params}`, { headers });
      setSubmissions(res.data);
    } catch (err) { console.error(err); setSubmissions([]); }
    finally { setSubLoading(false); }
  };

  useEffect(() => { if (tab === 'submissions') loadSubmissions(); }, [tab, filterDate]);

  // ── Load Attendance data ───────────────────────────────────────
  const loadAttendance = async () => {
    setAttLoading(true); setAttMsg('');
    try {
      const [studRes, actRes, classRes] = await Promise.all([
        api.get(`${API}/api/trainer/students`, { headers }),
        api.get(`${API}/api/attendance/class-activity/${attDate}`, { headers }),
        api.get(`${API}/api/classes/today`, { headers }).catch(() => ({ data: null })),
      ]);

      const students = studRes.data || [];
      // New API returns { activities, attendanceDeadline, deadlinePassed }
      const actPayload = actRes.data || {};
      const activities = actPayload.activities || (Array.isArray(actRes.data) ? actRes.data : []);
      const classInfo  = classRes.data;

      // Build activity map — includes attendanceStatus + markedByAdmin from backend
      const actMap = {};
      activities.forEach(a => {
        const sid = a.studentId?._id?.toString() || a.studentId?.toString();
        if (sid) actMap[sid] = a;
      });

      const rows = students.map(s => {
        const sid = s._id.toString();
        const act = actMap[sid] || null;
        return {
          student: s,
          status:        act?.attendanceStatus || 'not_marked',
          markedByAdmin: act?.markedByAdmin    || false,
          markedAt:      act?.markedAt         || null,
          classActivity: act,
        };
      });

      setAttRows(rows);
      // Use deadline from class-activity API if available, else from class info
      const deadlineFromAct = actPayload.attendanceDeadline;
      const mergedClassInfo = classInfo
        ? { ...classInfo, attendanceDeadline: deadlineFromAct || classInfo.attendanceDeadline }
        : (deadlineFromAct ? { attendanceDeadline: deadlineFromAct } : null);
      setAttClassInfo(mergedClassInfo);
      if (mergedClassInfo?.attendanceDeadline) {
        const d = new Date(mergedClassInfo.attendanceDeadline);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
        setAttDeadlineInput(local);
      } else {
        setAttDeadlineInput('');
      }
    } catch (err) {
      setAttMsg('❌ Failed to load: ' + err.message);
    } finally {
      setAttLoading(false);
    }
  };

  useEffect(() => { if (tab === 'attendance') loadAttendance(); }, [tab, attDate]);

  const markAttendance = async (studentId, status) => {
    setAttSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      await api.post(`${API}/api/attendance/mark`, { studentId, date: attDate, status }, { headers });
      // Lock this row permanently — markedByAdmin = true
      setAttRows(prev => prev.map(r =>
        r.student._id.toString() === studentId
          ? { ...r, status, markedByAdmin: true, markedAt: new Date().toISOString() }
          : r
      ));
      setAttMsg('');
    } catch (err) {
      const data = err.response?.data;
      if (data?.alreadyMarked) {
        setAttMsg(`🔒 Already marked as "${data.status}" — attendance is final and cannot be changed.`);
        loadAttendance(); // refresh to show locked state
      } else if (data?.deadlineNotReached) {
        const dl = new Date(data.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        setAttMsg(`⏳ Cannot mark attendance yet. Deadline is ${dl}. Please wait until it passes.`);
      } else {
        setAttMsg('❌ Failed to mark: ' + (data?.message || err.message));
      }
    } finally {
      setAttSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const markAllByWatch = async (threshold = 50) => {
    if (!window.confirm(`Mark present if watched ≥${threshold}%, absent otherwise?\n(Already finalized rows will be skipped)`)) return;
    let marked = 0;
    for (const row of attRows) {
      if (row.markedByAdmin) continue; // skip already finalized
      const pct = row.classActivity?.watchedPercent || 0;
      const status = pct >= threshold ? 'present' : 'absent';
      await markAttendance(row.student._id.toString(), status);
      marked++;
    }
    setAttMsg(`✅ Bulk marked ${marked} trainees based on ${threshold}% watch threshold.`);
  };

  const saveAttDeadline = async () => {
    if (!attClassInfo?._id) return alert('No class uploaded for this date yet.');
    setAttDeadlineSaving(true);
    try {
      const iso = attDeadlineInput ? new Date(attDeadlineInput).toISOString() : null;
      await api.patch(`${API}/api/classes/attendance-deadline/${attClassInfo._id}`, { attendanceDeadline: iso }, { headers });
      setAttMsg('✅ Attendance deadline saved!');
      loadAttendance();
    } catch (err) {
      setAttMsg('❌ Failed: ' + err.message);
    } finally {
      setAttDeadlineSaving(false);
    }
  };

  // ── Daily Feedback functions ─────────────────────────────────
  const loadFeedbackTrainees = async () => {
    if (!fbCourseId || !fbDate) return;
    setFbLoading(true); setFbMsg('');
    try {
      const res = await api.get(`${API}/api/daily-feedback/trainees?courseId=${fbCourseId}&date=${fbDate}`, { headers });
      setFbTrainees(res.data);
      // Pre-fill edits from existing feedback
      const edits = {};
      res.data.forEach(row => {
        if (row.feedback) edits[row.trainee._id] = { feedback: row.feedback.feedback, rating: row.feedback.rating || '' };
        else edits[row.trainee._id] = { feedback: '', rating: '' };
      });
      setFbEdits(edits);
    } catch (err) { console.error(err); setFbMsg('❌ Failed to load trainees'); }
    finally { setFbLoading(false); }
  };

  const saveFeedbackBulk = async () => {
    setFbSaving(true); setFbMsg('');
    try {
      const feedbacks = Object.entries(fbEdits)
        .filter(([, v]) => v.feedback?.trim())
        .map(([traineeId, v]) => ({ traineeId, feedback: v.feedback, rating: v.rating ? Number(v.rating) : null }));
      await api.post(`${API}/api/daily-feedback/bulk`, { courseId: fbCourseId, date: fbDate, feedbacks }, { headers });
      setFbMsg('✅ Feedback saved!');
      loadFeedbackTrainees();
    } catch (err) { setFbMsg('❌ ' + (err.response?.data?.message || err.message)); }
    finally { setFbSaving(false); }
  };

  const secCount   = (sec) => (questions || []).filter(q => q.section === sec).length;
  const totalScore = (sub) => {
    // Use trainer's manual score if available (graded); otherwise show auto-calculated section scores
    if (sub.gradedAt && sub.manualScore != null) return sub.manualScore;
    return (sub.secA?.score || 0) + (sub.secB?.score || 0) + (sub.secC?.score || 0);
  };
  const maxScore   = (sub) => ['secA', 'secB', 'secC'].reduce((t, k, i) => t + (sub[k]?.answers?.length || 0) * [1, 3, 5][i], 0);
  const secAnsweredCount = (sub, secKey) => (sub[secKey]?.answers || []).filter(a => a.isAnswered).length;

  const adminTabs = [
    { key: 'dashboard',   label: '🏠 Dashboard'   },
    { key: 'questions',   label: '📝 Questions'   },
    { key: 'submissions', label: '📬 Submissions'  },
    { key: 'attendance',  label: '📋 Attendance'   },
    { key: 'feedback',    label: '⭐ Daily Feedback' },
    { key: 'chat',        label: '💬 Group Chat'   },
    { key: 'video',       label: '🎬 Upload Video' },
    { key: 'courseinfo',  label: '🎓 Course Info'  },
    { key: 'reports',     label: '📊 Reports & WhatsApp' },
    { key: 'sessions',    label: '🕐 Login Tracker' },
  ];

  return (
    <div style={S.appWrapper}>
      <Navbar />
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside style={{ ...S.sidebar, background: T.sidebar }}>
        
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {adminTabs.map(t => (
            <button
              key={t.key}
              style={{ ...S.navBtn, ...(tab === t.key ? S.navBtnActive : {}) }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {/* Theme toggle */}
        <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
          <button onClick={toggleTheme} style={{
            width: '100%', padding: '10px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)',
            color: '#ccc', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{ ...S.page, background: T.bg, color: T.text }}>
      <div style={S.header}>
        <div>
          <h2 style={{ ...S.title, color: T.text }}>🛠 Admin Panel</h2>
          <p style={{ ...S.sub, color: T.textMuted }}>MERN Stack Developer Course Management</p>
        </div>
      </div>

      <div style={{ ...S.topRow, background: T.card, border: `1px solid ${T.border}`, display: tab === 'dashboard' ? 'none' : 'flex' }}>
        <div style={S.field}><label style={{ ...S.label, color: T.textMuted }}>Course ID</label>
          <input style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} placeholder="Paste course ID here" value={courseId} onChange={e => setCourseId(e.target.value)} /></div>
        <div style={S.field}><label style={{ ...S.label, color: T.textMuted }}>Date</label>
          <input type="date" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} value={date} onChange={e => setDate(e.target.value)} /></div>
        <button style={S.loadBtn} onClick={loadQuestions} disabled={!courseId}>🔄 Load</button>
      </div>

      {/* ── DEADLINE PICKER ────────────────────────────────────── */}
      {tab === 'dashboard' ? <AdminDashboard token={token} T={T} /> : tab === 'questions' && (
        <div style={{ background: '#fff8e1', border: '1.5px solid #ffe082', borderRadius: 10, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>⏰ Assignment Deadline</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
            <input
              type="datetime-local"
              style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, margin: 0, flex: 1, minWidth: 200, border: '1.5px solid #ffe082', background: '#fffdf0' }}
              value={deadlineInput}
              onChange={e => setDeadlineInput(e.target.value)}
            />
            <button
              onClick={saveDeadline}
              disabled={deadlineSaving || !courseId}
              style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {deadlineSaving ? 'Saving…' : '💾 Set Deadline'}
            </button>
            {deadlineInput && (
              <button
                onClick={() => { setDeadlineInput(''); }}
                title="Clear — reset to midnight"
                style={{ padding: '8px 10px', background: '#eee', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: T.textMuted }}
              >✕</button>
            )}
          </div>
          {deadlineMsg && (
            <span style={{ fontSize: 12, color: deadlineMsg.startsWith('✅') ? '#1D9E75' : '#c0392b', fontWeight: 600 }}>{deadlineMsg}</span>
          )}
          {!deadlineMsg && savedDeadline && (
            <span style={{ fontSize: 12, color: '#b8860b' }}>
              Current: {new Date(savedDeadline).toLocaleString('en-IN')}
            </span>
          )}
          {!deadlineMsg && !savedDeadline && (
            <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>Default: midnight of selected date</span>
          )}
        </div>
      )}



      {/* ── QUESTIONS TAB ─────────────────────────────────────── */}
      {tab === 'questions' && (
        <div>
          <div style={{ ...S.secTabs, background: T.card, borderColor: T.border }}>
            {SECTIONS.map(sec => (
              <button key={sec.key}
                style={{ ...S.secTab, borderBottom: activeSection === sec.key ? `3px solid ${sec.color}` : '3px solid transparent', color: activeSection === sec.key ? sec.color : '#888', fontWeight: activeSection === sec.key ? 700 : 500 }}
                onClick={() => setActiveSection(sec.key)}>
                <span style={{ ...S.secDot, background: sec.color }} />
                {sec.label}
                <span style={{ ...S.chip, background: sec.light, color: sec.color }}>{secCount(sec.key)}/{sec.count}</span>
              </button>
            ))}
          </div>
          {SECTIONS.map(sec => activeSection === sec.key && (
            <div key={sec.key} style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, background: T.card, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ ...S.cardTitle, color: sec.color }}>{sec.label} — {sec.desc}</h3>
                  <p style={S.secDesc}>Each question: <b>{sec.marks} mark{sec.marks > 1 ? 's' : ''}</b> &nbsp;|&nbsp; Target: <b>{sec.count} questions</b></p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.addRowBtn, borderColor: sec.color, color: sec.color }} onClick={() => addRow(sec.key)}>+ Add Row</button>
                  <button style={{ ...S.saveBtn, background: sec.color, opacity: saving[sec.key] ? 0.7 : 1 }} onClick={() => saveSection(sec.key)} disabled={saving[sec.key]}>
                    {saving[sec.key] ? 'Saving...' : `💾 Save Section ${sec.key}`}
                  </button>
                </div>
              </div>
              {saveMsg[sec.key] && <div style={{ ...S.msgBox, background: saveMsg[sec.key].startsWith('✅') ? '#e6f7f2' : '#fdecea', color: saveMsg[sec.key].startsWith('✅') ? '#1D9E75' : '#c0392b' }}>{saveMsg[sec.key]}</div>}
              <div style={{ ...S.qGrid, borderColor: T.border }}>
                <div style={{ ...S.qGridHeader, background: T.rowHover, color: T.textMuted }}><span style={{ width: 36 }}>#</span><span style={{ flex: 1 }}>Question Text</span><span style={{ width: 80, textAlign: 'center' }}>Marks</span><span style={{ width: 36 }}></span></div>
                {secInputs[sec.key].map((row, idx) => (
                  <div key={idx} style={{ ...S.qRow, borderColor: T.border }}>
                    <div style={{ ...S.qNum, background: sec.light, color: sec.color }}>{idx + 1}</div>
                    <textarea style={{ ...S.qInput, background: T.input, borderColor: T.inputBorder, color: T.text }} placeholder={`Question ${idx + 1}...`} value={row.text} rows={2} onChange={e => updateRow(sec.key, idx, 'text', e.target.value)} />
                    <input type="number" style={{ ...S.marksInput, background: T.input, borderColor: T.inputBorder, color: T.text }} value={row.marks} min={1} onChange={e => updateRow(sec.key, idx, 'marks', e.target.value)} />
                    <button style={S.delRowBtn} onClick={() => removeRow(sec.key, idx)}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <span style={{ fontSize: 13, color: T.textMuted }}>{secInputs[sec.key].filter(r => r.text.trim()).length} of {secInputs[sec.key].length} filled</span>
                <button style={{ ...S.saveBtn, background: sec.color, opacity: saving[sec.key] ? 0.7 : 1 }} onClick={() => saveSection(sec.key)} disabled={saving[sec.key]}>
                  {saving[sec.key] ? 'Saving...' : `💾 Save Section ${sec.key}`}
                </button>
              </div>
            </div>
          ))}
          {questions.length > 0 && (
            <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
              <h3 style={{ ...S.cardTitle, color: T.text }}>📋 Saved Questions for {date} ({questions.length} total)</h3>
              {SECTIONS.map(sec => {
                const qs = questions.filter(q => q.section === sec.key);
                if (!qs.length) return null;
                return (
                  <div key={sec.key} style={{ marginBottom: 16 }}>
                    <div style={{ ...S.secBadge, background: sec.color }}>{sec.label} — {sec.desc} — {qs.length} questions</div>
                    {qs.map((q, i) => (
                      <div key={q._id} style={{ ...S.savedQ, borderColor: T.border }}>
                        <span style={{ ...S.qNum, background: sec.light, color: sec.color, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 14, color: T.text }}>{q.text}</span>
                        <span style={{ ...S.chip, background: sec.light, color: sec.color, flexShrink: 0 }}>{q.marks}m</span>
                        <button style={S.delRowBtn} onClick={() => deleteQuestion(q._id)}>🗑</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUBMISSIONS TAB ───────────────────────────────────── */}
      {tab === 'submissions' && (
        <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <h3 style={{ ...S.cardTitle, margin: 0 }}>📬 Trainee Submissions</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ ...S.label, color: T.textMuted }}>Date:</label>
              <input type="date" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              {filterDate && <button style={{ ...S.loadBtn, padding: '8px 12px', background: '#555' }} onClick={() => setFilterDate('')}>All Dates</button>}
              <button style={{ ...S.loadBtn, padding: '8px 14px' }} onClick={loadSubmissions}>🔄</button>
            </div>
          </div>

          {subLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ color: T.textMuted, fontSize: 14 }}>No submissions found for this date.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...S.subSummary, background: T.rowHover, color: T.textSub }}>
                <span>🧑‍💻 {submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#1D9E75' }}>✅ {submissions.filter(s => s.status === 'submitted').length} submitted</span>
                <span style={{ color: '#e67e22' }}>⏳ {submissions.filter(s => s.status !== 'submitted').length} in progress</span>
              </div>

              {submissions.map(sub => {
                const isExpanded = expandedSub === sub._id;
                const score = totalScore(sub);
                const max   = maxScore(sub);
                const pct   = max > 0 ? Math.round((score / max) * 100) : 0;
                const secAnswers = sub[`sec${expandedSec}`]?.answers || [];

                return (
                  <div key={sub._id} style={{ border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ ...S.subHeader, background: isExpanded ? T.rowHover : T.card, cursor: 'pointer' }}
                      onClick={() => setExpandedSub(isExpanded ? null : sub._id)}>
                      <div style={S.traineeAvatar}>{sub.trainee?.name?.charAt(0)?.toUpperCase() || '?'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{sub.trainee?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>{sub.trainee?.email} &nbsp;|&nbsp; {sub.date}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: pct >= 75 ? '#1D9E75' : pct >= 50 ? '#f5a623' : '#e74c3c' }}>
                            {score}<span style={{ fontSize: 12, color: T.textMuted, fontWeight: 400 }}>/{max}</span>
                          </div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{pct}%</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: sub.status === 'submitted' ? '#e6f7f2' : '#fff8e1', color: sub.status === 'submitted' ? '#1D9E75' : '#e67e22' }}>
                          {sub.status === 'submitted' ? '✅ Submitted' : '⏳ In Progress'}
                        </span>
                        {sub.status === 'submitted' && (
                          <button onClick={e => { e.stopPropagation(); resetSubmission(sub); }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1.5px solid #185FA5', background: '#e6f0fb', color: '#185FA5', cursor: 'pointer', fontWeight: 700 }}>
                            🔓 Reopen
                          </button>
                        )}
                        {sub.status === 'submitted' && sub.gradedAt && !sub.scorePublished && (
                          <button onClick={e => {
                            e.stopPropagation();
                            const fb = window.prompt(`Admin feedback for ${sub.trainee?.name} (optional):`, '');
                            if (fb !== null) publishSubmission(sub, fb);
                          }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1.5px solid #1D9E75', background: '#e6f7f2', color: '#1D9E75', cursor: 'pointer', fontWeight: 700 }}>
                            📤 Publish Score
                          </button>
                        )}
                        {sub.scorePublished && (
                          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#1D9E7522', color: '#1D9E75', fontWeight: 700 }}>✅ Published</span>
                        )}
                        {sub.scorePublished && (
                          <button onClick={e => { e.stopPropagation(); unpublishSubmission(sub); }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1.5px solid #e67e22', background: '#fff8e1', color: '#e67e22', cursor: 'pointer', fontWeight: 700 }}>
                            🙈 Unpublish
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); deleteSubmission(sub); }}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1.5px solid #e74c3c', background: '#fdecea', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>
                          🗑️
                        </button>
                        <span style={{ fontSize: 18, color: T.textMuted }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ ...S.scoreBreakdown, background: T.rowHover }}>
                          {SECTIONS.map(sec => {
                            const s = sub[`sec${sec.key}`];
                            return (
                              <div key={sec.key} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: sec.color, fontWeight: 700, marginBottom: 2 }}>{sec.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: sec.color }}>{s?.score || 0}</div>
                                <div style={{ fontSize: 11, color: T.textMuted }}>{secAnsweredCount(sub, `sec${sec.key}`)}/{s?.answers?.length || 0} answered</div>
                              </div>
                            );
                          })}
                          {sub.submittedAt && (
                            <div style={{ textAlign: 'center', borderLeft: '1px solid #eee', paddingLeft: 20 }}>
                              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 2 }}>Submitted At</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1D9E75' }}>{new Date(sub.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                              <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(sub.submittedAt).toLocaleDateString('en-IN')}</div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 14 }}>
                          {SECTIONS.map(sec => (
                            <button key={sec.key}
                              style={{ ...S.ansSecTab, borderBottom: expandedSec === sec.key ? `2px solid ${sec.color}` : '2px solid transparent', color: expandedSec === sec.key ? sec.color : '#aaa' }}
                              onClick={() => setExpandedSec(sec.key)}>
                              {sec.label}
                              <span style={{ ...S.chip, background: sec.light, color: sec.color, marginLeft: 6 }}>
                                {secAnsweredCount(sub, `sec${sec.key}`)} answered
                              </span>
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {secAnswers.length === 0
                            ? <p style={{ color: T.textMuted, fontSize: 13 }}>No answers in this section.</p>
                            : secAnswers.map((ans, idx) => {
                                const sec = SECTIONS.find(s => s.key === expandedSec);
                                return (
                                  <div key={idx} style={{ ...S.answerCard, borderLeft: `3px solid ${ans.isAnswered ? sec.color : '#ddd'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                      <div style={{ ...S.qNum, background: sec.light, color: sec.color, flexShrink: 0, marginTop: 2 }}>{idx + 1}</div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                                          {ans.questionText}
                                          <span style={{ ...S.chip, background: sec.light, color: sec.color, marginLeft: 8 }}>{ans.marks}m</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: ans.isAnswered ? '#1e3a5f' : '#bbb', background: ans.isAnswered ? '#f4f6fb' : '#fafafa', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontStyle: ans.isAnswered ? 'normal' : 'italic', minHeight: 36 }}>
                                          {ans.isAnswered ? ans.answerText : 'No answer given'}
                                        </div>
                                        <CodeAnswerInline
                                          questionId={ans.questionId?.toString()}
                                          date={sub.date}
                                          traineeId={sub.traineeId?.toString?.() || sub.traineeId}
                                          token={token}
                                        />
                                      </div>
                                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: ans.isAnswered ? '#e6f7f2' : '#f5f5f5', color: ans.isAnswered ? '#1D9E75' : '#bbb' }}>
                                        {ans.isAnswered ? '✓ Answered' : '— Skipped'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                          }
                        </div>

                        {/* Trainer Grade & Feedback */}
                        <div style={{ marginTop: 18, borderTop: '2px solid #eef', paddingTop: 16 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>
                            🎯 Trainer Grade &amp; Feedback
                          </div>
                          {sub.gradedAt ? (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                              <div style={{ background: T.rowHover, border: '1.5px solid #185FA5', borderRadius: 10, padding: '12px 20px', textAlign: 'center', minWidth: 100 }}>
                                <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 700, marginBottom: 4 }}>Final Score</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#185FA5' }}>{sub.manualScore ?? '—'}</div>
                                <div style={{ fontSize: 11, color: T.textMuted }}>by Trainer</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 200, background: T.rowHover, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#8e44ad', marginBottom: 6 }}>💬 Trainer Feedback</div>
                                <div style={{ fontSize: 13, color: sub.trainerFeedback ? '#333' : '#bbb', fontStyle: sub.trainerFeedback ? 'normal' : 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                  {sub.trainerFeedback || 'No feedback written by trainer yet.'}
                                </div>
                                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                                  Graded: {new Date(sub.gradedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: '#fff8e1', border: '1px solid #ffe0b2', borderRadius: 10, padding: '12px 16px', color: '#e67e22', fontSize: 13 }}>
                              ⏳ Not yet graded by trainer. Trainer Panel → Grading tab.
                            </div>
                          )}
                          {sub.scorePublished && sub.adminFeedback && (
                            <div style={{ marginTop: 12, background: '#e6f7f2', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 14px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', marginBottom: 4 }}>📝 Admin Feedback (published)</div>
                              <div style={{ fontSize: 13, color: T.text, whiteSpace: 'pre-wrap' }}>{sub.adminFeedback}</div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DAILY FEEDBACK TAB ────────────────────────────────── */}
      {tab === 'feedback' && (
        <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <h3 style={{ ...S.cardTitle, color: T.text }}>⭐ Daily Performance Feedback</h3>
          <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 16 }}>
            Review each trainee's attendance + assignment, then write personalised daily feedback.
          </p>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={S.field}>
              <label style={{ ...S.label, color: T.textMuted }}>Course ID</label>
              <input
                style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 220 }}
                placeholder="Paste courseId here"
                value={fbCourseId}
                onChange={e => setFbCourseId(e.target.value)}
              />
            </div>
            <div style={S.field}>
              <label style={{ ...S.label, color: T.textMuted }}>Date</label>
              <input
                type="date" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 160 }}
                value={fbDate}
                onChange={e => setFbDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button style={{ ...S.saveBtn, padding: '8px 18px' }} onClick={loadFeedbackTrainees} disabled={fbLoading}>
                {fbLoading ? 'Loading...' : '🔍 Load Trainees'}
              </button>
            </div>
          </div>

          {/* Trainee rows */}
          {fbTrainees.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                {fbTrainees.map(row => {
                  const id = row.trainee._id;
                  const edit = fbEdits[id] || { feedback: '', rating: '' };
                  const attColor = row.attendance === 'present' ? '#1D9E75' : row.attendance === 'late' ? '#f5a623' : '#E24B4A';
                  return (
                    <div key={id} style={{ background: '#1a1a2e', borderRadius: 10, padding: 14, border: '1px solid #2a2a3e' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#e0e0e0', fontSize: 14 }}>{row.trainee.name}</div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>{row.trainee.email}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, background: attColor + '22', color: attColor, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                            {row.attendance === 'present' ? '✅ Present' : row.attendance === 'late' ? '🕐 Late' : '❌ Absent'}
                          </span>
                          <span style={{ fontSize: 12, background: row.assignment.submitted ? '#1e3a5f' : '#3a1e1e', color: row.assignment.submitted ? '#60aaff' : '#ff8080', padding: '3px 9px', borderRadius: 20 }}>
                            {row.assignment.submitted
                              ? `📝 Score: ${row.assignment.manualScore ?? 'Pending'}`
                              : '📝 Not Submitted'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <textarea
                          style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, flex: 1, minHeight: 70, resize: 'vertical', fontSize: 13 }}
                          placeholder={`Write feedback for ${row.trainee.name}…`}
                          value={edit.feedback}
                          onChange={e => setFbEdits(prev => ({ ...prev, [id]: { ...prev[id], feedback: e.target.value } }))}
                        />
                        <div>
                          <label style={{ ...S.label, marginBottom: 4, display: 'block' }}>Rating</label>
                          <select
                            style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 80 }}
                            value={edit.rating}
                            onChange={e => setFbEdits(prev => ({ ...prev, [id]: { ...prev[id], rating: e.target.value } }))}
                          >
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
                          </select>
                        </div>
                      </div>

                      {row.feedback && (
                        <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted }}>
                          Last saved: "{row.feedback.feedback.slice(0, 80)}{row.feedback.feedback.length > 80 ? '…' : ''}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button style={{ ...S.saveBtn, width: '100%', padding: 14, fontSize: 15 }} onClick={saveFeedbackBulk} disabled={fbSaving}>
                {fbSaving ? 'Saving...' : '💾 Save All Feedback'}
              </button>
              {fbMsg && <p style={{ marginTop: 10, color: fbMsg.startsWith('✅') ? '#1D9E75' : '#E24B4A', fontSize: 14 }}>{fbMsg}</p>}
            </>
          )}

          {!fbLoading && fbTrainees.length === 0 && fbCourseId && (
            <p style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 }}>
              Click "Load Trainees" to see today's performance summary.
            </p>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TAB ────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <h3 style={{ ...S.cardTitle, color: T.text }}>📋 Attendance Management</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            After the class attendance deadline passes, review who watched and mark present/absent.
          </p>

          {/* Date selector + refresh */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ ...S.label, color: T.textMuted }}>Date</label>
              <input type="date" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 160 }} value={attDate} onChange={e => setAttDate(e.target.value)} />
            </div>
            <button style={{ ...S.loadBtn, marginTop: 18 }} onClick={loadAttendance}>🔄 Refresh</button>
          </div>

          {/* Class info + deadline setter */}
          <div style={{ background: T.rowHover, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            {attClassInfo ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 6 }}>
                  🎬 {attClassInfo.title || 'Class'} &nbsp;
                  <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 400 }}>({attClassInfo.date})</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ ...S.label, margin: 0 }}>⏰ Attendance Deadline</label>
                    <input type="datetime-local" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 220, margin: 0 }}
                      value={attDeadlineInput} onChange={e => setAttDeadlineInput(e.target.value)} />
                  </div>
                  <button style={{ ...S.saveBtn, padding: '8px 14px', marginTop: 18 }}
                    onClick={saveAttDeadline} disabled={attDeadlineSaving}>
                    {attDeadlineSaving ? 'Saving…' : '💾 Set Deadline'}
                  </button>
                  {attClassInfo.attendanceDeadline && (
                    <span style={{ fontSize: 12, color: new Date() > new Date(attClassInfo.attendanceDeadline) ? '#e74c3c' : '#1D9E75', fontWeight: 600, marginTop: 18 }}>
                      {new Date() > new Date(attClassInfo.attendanceDeadline) ? '⌛ Deadline passed' : '⏳ Deadline not reached yet'}
                      {' — '}{new Date(attClassInfo.attendanceDeadline).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: '#e67e22', fontSize: 13 }}>⚠️ No class uploaded for {attDate}. Go to Upload Video tab first.</div>
            )}
          </div>

          {/* Bulk actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Bulk mark:</span>
            <button style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1.5px solid #1D9E75', background: '#e6f7f2', color: '#1D9E75', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => markAllByWatch(50)}>✅ ≥50% watched → Present</button>
            <button style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1.5px solid #185FA5', background: '#e6f0fb', color: '#185FA5', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => markAllByWatch(75)}>✅ ≥75% watched → Present</button>
            <button style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e74c3c', background: '#fdecea', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}
              onClick={async () => {
                if (!window.confirm('Mark ALL trainees as Present? (Already finalized rows will be skipped)')) return;
                for (const r of attRows) {
                  if (r.markedByAdmin) continue;
                  await markAttendance(r.student._id.toString(), 'present');
                }
                setAttMsg('✅ All marked Present.');
              }}>📋 All Present</button>
          </div>
          {/* Deadline enforcement notice */}
          {attClassInfo?.attendanceDeadline && new Date() < new Date(attClassInfo.attendanceDeadline) && (
            <div style={{ marginBottom: 12, background: '#fff8e1', border: '1.5px solid #f5a623', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#e67e22', fontWeight: 600 }}>
              ⏳ Attendance marking is locked until deadline passes:&nbsp;
              <strong>{new Date(attClassInfo.attendanceDeadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
              &nbsp;— Trainees can still open and watch the class until then.
            </div>
          )}
          {attMsg && <div style={{ marginBottom: 12, fontSize: 13, color: attMsg.startsWith('✅') ? '#1D9E75' : '#e74c3c', fontWeight: 600 }}>{attMsg}</div>}

          {attLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>Loading...</div>
          ) : attRows.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 14, padding: 20 }}>No trainees found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px', gap: 8, padding: '6px 12px', background: T.rowHover, borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                <span>Trainee</span>
                <span style={{ textAlign: 'center' }}>Opened</span>
                <span style={{ textAlign: 'center' }}>Watched</span>
                <span style={{ textAlign: 'center' }}>Status</span>
                <span style={{ textAlign: 'center' }}>Mark</span>
              </div>
              {attRows.map(row => {
                const sid = row.student._id.toString();
                const act = row.classActivity;
                const pct = act?.watchedPercent || 0;
                const pctColor = pct >= 75 ? '#1D9E75' : pct >= 50 ? '#f5a623' : '#e74c3c';
                const statusColor = row.status === 'present' ? '#1D9E75' : row.status === 'absent' ? '#e74c3c' : '#aaa';
                const isLocked = row.markedByAdmin; // cannot re-mark
                return (
                  <div key={sid} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px', gap: 8, padding: '10px 12px', background: isLocked ? (row.status === 'present' ? '#f0fdf7' : '#fff5f5') : '#fff', border: `1px solid ${isLocked ? (row.status === 'present' ? '#a7f3d0' : '#fecaca') : '#eef'}`, borderRadius: 10, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{row.student.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{row.student.email}</div>
                      {isLocked && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>🔒 Marked at {new Date(row.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13 }}>
                      {act?.opened ? <span style={{ color: '#1D9E75', fontWeight: 700 }}>✅ Yes</span> : <span style={{ color: '#e74c3c' }}>❌ No</span>}
                      {act?.openedAt && <div style={{ fontSize: 10, color: T.textMuted }}>{new Date(act.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {act ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 14, color: pctColor }}>{pct}%</div>
                          <div style={{ fontSize: 10, color: T.textMuted }}>{Math.floor((act.watchedSeconds || 0) / 60)}m watched</div>
                        </>
                      ) : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: row.status === 'present' ? '#e6f7f2' : row.status === 'absent' ? '#fdecea' : '#f5f5f5', padding: '4px 10px', borderRadius: 20 }}>
                        {row.status === 'present' ? '✅ Present' : row.status === 'absent' ? '❌ Absent' : '— Unmarked'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {isLocked ? (
                        <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic', padding: '5px 8px' }}>🔒 Final</span>
                      ) : (
                        <>
                          <button style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: '1.5px solid #1D9E75', background: row.status === 'present' ? '#1D9E75' : '#e6f7f2', color: row.status === 'present' ? '#fff' : '#1D9E75', cursor: 'pointer', fontWeight: 700, opacity: attSaving[sid] ? 0.6 : 1 }}
                            onClick={() => markAttendance(sid, 'present')} disabled={attSaving[sid]}>
                            ✅ P
                          </button>
                          <button style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: '1.5px solid #e74c3c', background: row.status === 'absent' ? '#e74c3c' : '#fdecea', color: row.status === 'absent' ? '#fff' : '#e74c3c', cursor: 'pointer', fontWeight: 700, opacity: attSaving[sid] ? 0.6 : 1 }}
                            onClick={() => markAttendance(sid, 'absent')} disabled={attSaving[sid]}>
                            ❌ A
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Summary bar */}
              <div style={{ display: 'flex', gap: 16, padding: '10px 16px', background: T.rowHover, borderRadius: 10, marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                <span>Total: {attRows.length}</span>
                <span style={{ color: '#1D9E75' }}>✅ Present: {attRows.filter(r => r.status === 'present').length}</span>
                <span style={{ color: '#e74c3c' }}>❌ Absent: {attRows.filter(r => r.status === 'absent').length}</span>
                <span style={{ color: T.textMuted }}>— Unmarked: {attRows.filter(r => r.status === 'not_marked').length}</span>
                <span style={{ color: '#185FA5' }}>👁️ Opened class: {attRows.filter(r => r.classActivity?.opened).length}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GROUP CHAT TAB ────────────────────────────────────── */}
      {tab === 'chat' && (
        <AdminGroupChat user={user} token={token} />
      )}

      {/* ── VIDEO TAB ─────────────────────────────────────────── */}
      {tab === 'video' && (
        <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <h3 style={{ ...S.cardTitle, color: T.text }}>🎬 Upload Today's Class Video</h3>
          <p style={S.warning}>⚠️ When a new video is uploaded — the previous class will automatically expire!</p>
          <div style={S.field}>
            <label style={{ ...S.label, color: T.textMuted }}>Class Title</label>
            <input style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} placeholder="e.g. Day 5 — React Hooks Deep Dive" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={{ ...S.label, color: T.textMuted }}>📋 Attendance Deadline <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>(trainees must watch by this time; you mark attendance after)</span></label>
            <input type="datetime-local" style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} value={videoAttDeadline} onChange={e => setVideoAttDeadline(e.target.value)} />
            {videoAttDeadline && (
              <span style={{ fontSize: 12, color: '#185FA5', marginTop: 4 }}>
                ⏰ Deadline: {new Date(videoAttDeadline).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div style={S.uploadBox}>
            <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} style={{ marginBottom: 12 }} />
            {videoFile && <p style={{ color: '#1D9E75', fontSize: 13 }}>✅ Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>
          <button style={{ ...S.saveBtn, background: '#1e3a5f', opacity: uploading ? 0.7 : 1 }} onClick={uploadVideo} disabled={uploading}>
            {uploading ? 'Uploading...' : '🎬 Upload Class Video'}
          </button>
          {uploadMsg && <p style={{ marginTop: 12, fontSize: 14, color: uploadMsg.startsWith('✅') ? '#1D9E75' : '#E24B4A' }}>{uploadMsg}</p>}
        </div>
      )}

      {/* ── COURSE INFO TAB ───────────────────────────────────── */}
      {tab === 'courseinfo' && (
        <div style={{ background: T.card, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px #0001' }}>
          <h3 style={{ ...S.cardTitle, color: T.text }}>🎓 Course Information Management</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
            Manage courses — create, rename, set technologies & syllabus, and enroll trainees. All changes appear on the trainee's <strong>📚 My Course</strong> page.
          </p>

          {/* Top row: selector + create button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ ...S.label, color: T.textMuted }}>Select Course</label>
              <select style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} value={ciSelected} onChange={e => selectCiCourse(e.target.value)}>
                <option value="">-- Choose a course --</option>
                {ciCourses.map(c => (
                  <option key={c._id} value={c._id}>{c.title} {c.enrolledStudents?.length ? `(${c.enrolledStudents.length} trainees)` : ''}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setCiShowCreate(v => !v)}
              style={{ padding: '9px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ➕ New Course
            </button>
            {ciSelected && (
              <button
                onClick={deleteCiCourse}
                style={{ padding: '9px 14px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                🗑 Delete
              </button>
            )}
          </div>

          {/* Create new course panel */}
          {ciShowCreate && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ ...S.label, color: T.textMuted }}>New Course Name</label>
                <input
                  style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }}
                  value={ciNewName}
                  onChange={e => setCiNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createNewCourse()}
                  placeholder="e.g. MERN Full Stack Development"
                  autoFocus
                />
              </div>
              <button
                onClick={createNewCourse}
                disabled={ciCreating || !ciNewName.trim()}
                style={{ padding: '9px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {ciCreating ? '⏳ Creating...' : '✅ Create'}
              </button>
              <button onClick={() => { setCiShowCreate(false); setCiNewName(''); }}
                style={{ padding: '9px 14px', background: T.card, color: '#64748b', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {ciSelected && (
            <>
              {/* Course Title */}
              <div style={S.field}>
                <label style={{ ...S.label, color: T.textMuted }}>Course Title</label>
                <input style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, background: T.input, borderColor: T.inputBorder, color: T.text }} value={ciTitle} onChange={e => setCiTitle(e.target.value)} placeholder="e.g. MERN Full Stack Developer" />
              </div>

              {/* Description */}
              <div style={S.field}>
                <label style={{ ...S.label, color: T.textMuted }}>Course Description</label>
                <textarea
                  style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, height: 80, resize: 'vertical' }}
                  value={ciDesc}
                  onChange={e => setCiDesc(e.target.value)}
                  placeholder="Brief overview of what trainees will learn..."
                />
              </div>

              {/* Technologies — tag-based */}
              <div style={S.field}>
                <label style={{ ...S.label, color: T.textMuted }}>Technologies</label>
                {/* Tag display */}
                {ciTechList.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {ciTechList.map(tech => (
                      <span key={tech} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#7c6af515', color: '#7c6af5', border: '1px solid #7c6af540', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {tech}
                        <button onClick={() => removeTech(tech)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c6af5', fontSize: 13, padding: 0, lineHeight: 1, fontWeight: 700 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Input row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, flex: 1 }}
                    value={ciTechInput}
                    onChange={e => setCiTechInput(e.target.value)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTech())}
                    placeholder="Type technology name, press Enter or comma to add (e.g. MongoDB, React)"
                  />
                  <button onClick={addTech}
                    style={{ padding: '9px 16px', background: '#7c6af5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    + Add
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>💡 Tip: Type multiple at once separated by commas — e.g. "MongoDB, Express, React, Node.js"</div>
              </div>

              {/* Syllabus */}
              <div style={S.field}>
                <label style={{ ...S.label, color: T.textMuted }}>Syllabus (Week / Module wise)</label>
                {ciSyllabus.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, width: 140, flexShrink: 0 }}
                      placeholder="Week 1 / Module 1"
                      value={row.week}
                      onChange={e => { const s = [...ciSyllabus]; s[i] = { ...s[i], week: e.target.value }; setCiSyllabus(s); }}
                    />
                    <input
                      style={{ ...S.input, background: T.input, borderColor: T.inputBorder, color: T.text, flex: 1 }}
                      placeholder="Topics covered e.g. HTML, CSS basics, Flexbox"
                      value={row.topics}
                      onChange={e => { const s = [...ciSyllabus]; s[i] = { ...s[i], topics: e.target.value }; setCiSyllabus(s); }}
                    />
                    <button
                      onClick={() => setCiSyllabus(ciSyllabus.filter((_, j) => j !== i))}
                      style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button
                  onClick={() => setCiSyllabus([...ciSyllabus, { week: '', topics: '' }])}
                  style={{ background: '#e0f2fe', color: '#0284c7', border: '1px dashed #0284c7', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  + Add Week/Module
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button
                  style={{ ...S.saveBtn, background: '#1e3a5f', opacity: ciSaving ? 0.7 : 1 }}
                  onClick={saveCiCourse}
                  disabled={ciSaving}>
                  {ciSaving ? '⏳ Saving...' : '💾 Save Course Info'}
                </button>
                {ciMsg && <span style={{ fontSize: 14, color: ciMsg.startsWith('✅') ? '#10b981' : '#ef4444', fontWeight: 600 }}>{ciMsg}</span>}
              </div>

              {/* Enroll Trainees */}
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1.5px dashed #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>👥 Enroll / Unenroll Trainees</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Toggle to assign trainees to this course. They will see this course's content on their My Course page.</div>
                  </div>
                  {ciEnrollMsg && <span style={{ fontSize: 13, color: ciEnrollMsg.startsWith('✅') ? '#10b981' : '#ef4444', fontWeight: 600 }}>{ciEnrollMsg}</span>}
                </div>

                {ciTrainees.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>No trainees found. Trainees need to register first.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ciTrainees.map(t => {
                      const enrolled = ciEnrolled.includes(t._id);
                      return (
                        <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: enrolled ? '#f0fdf4' : '#f8fafc', border: `1px solid ${enrolled ? '#10b981' : '#e2e8f0'}`, borderRadius: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: enrolled ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                            {t.name?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{t.email}</div>
                          </div>
                          {enrolled && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#dcfce7', padding: '2px 10px', borderRadius: 20 }}>✓ Enrolled</span>}
                          <button
                            onClick={() => toggleEnroll(t._id)}
                            style={{ padding: '6px 16px', background: enrolled ? '#fee2e2' : '#1e3a5f', color: enrolled ? '#ef4444' : '#fff', border: enrolled ? '1px solid #fca5a5' : 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {enrolled ? 'Remove' : 'Enroll'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── REPORTS & WHATSAPP TAB ──────────────────────────── */}
      {tab === 'reports' && <AdminReportsWhatsApp token={token} />}

      {/* ── LOGIN TRACKER TAB ──────────────────────────────────── */}
      {tab === 'sessions' && <AdminSessionTracker token={token} />}

    </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ADMIN GROUP CHAT component
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  ADMIN REPORTS & WHATSAPP COMPONENT
// ════════════════════════════════════════════════════════════
function AdminReportsWhatsApp({ token }) {
  const { isDark } = useTheme();
  const [students, setStudents] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [report, setReport] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [customMsg, setCustomMsg] = React.useState('');
  const [sendMode, setSendMode] = React.useState('attendance');

  const T = {
    bg: isDark ? '#0f0f1a' : '#f0f4f8', card: isDark ? '#1a1a2e' : '#ffffff',
    text: isDark ? '#f0f0f0' : '#1e293b', muted: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#2a2a3e' : '#e2e8f0', input: isDark ? '#242438' : '#f8fafc',
    ib: isDark ? '#3a3a50' : '#e2e8f0',
  };

  const hdr = { Authorization: `Bearer ${token}` };
  const API2 = 'https://codemedha-production-47c1.up.railway.app';

  React.useEffect(() => {
    api.get(`${API2}/api/trainer/students`, { headers: hdr })
      .then(r => setStudents(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const loadReport = async (id) => {
    if (!id) return;
    setLoading(true); setReport(null); setMsg('');
    try {
      const { data } = await api.get(`${API2}/api/trainer/student-weekly-report/${id}`, { headers: hdr });
      setReport(data);
    } catch (e) { setMsg('Failed to load report: ' + (e.response?.data?.message || e.message)); }
    finally { setLoading(false); }
  };

  const buildAttendanceMsg = (r) => {
    const s = r.student;
    const a = r.attendance;
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayRec = a.days?.find(d => d.date === new Date().toISOString().split('T')[0]);
    const statusStr = todayRec ? ({ present: 'Present ✅', absent: 'Absent ❌', late: 'Late ⚠️' }[todayRec.status] || 'Not marked') : 'Not yet marked';
    return `📚 *LMS Attendance Update*

Dear Parent/Guardian of *${s.name}*,

📅 Date: ${today}
🏫 Today's Attendance: *${statusStr}*

📊 This Week:
• Present: ${a.present} days
• Absent: ${a.absent} days
• Rate: ${a.percentage}%

${a.percentage >= 75 ? '✅ Great attendance this week!' : a.percentage >= 50 ? '⚠️ Needs improvement.' : '❌ Attendance is critically low.'}

— LMS Training Team`;
  };

  const buildWeeklyReportMsg = (r) => {
    const s = r.student;
    const a = r.attendance;
    const asgn = r.assignments;
    return `📈 *Weekly Performance Report*

Dear Parent/Guardian of *${s.name}*,

📅 Period: ${r.period?.from} to ${r.period?.to}

📊 *Attendance*
• Present: ${a.present} / Absent: ${a.absent}
• Rate: *${a.percentage}%* ${a.percentage >= 75 ? '✅' : a.percentage >= 50 ? '⚠️' : '❌'}

📝 *Assignments*
• Submitted: ${asgn.submitted}
• Pending: ${asgn.pending}
• Total Score: ${asgn.totalScore} marks

${a.percentage >= 75 ? '🌟 Excellent performance this week!' : a.percentage >= 50 ? '📢 Please encourage regular attendance.' : '⚠️ Urgent: Low attendance and engagement.'}

— LMS Training Team`;
  };

  const openWhatsApp = () => {
    if (!report?.student?.parentPhone) {
      setMsg('No parent phone number. Student must add it in Profile → Parent Details.');
      return;
    }
    const text = sendMode === 'attendance' ? buildAttendanceMsg(report)
               : sendMode === 'report'     ? buildWeeklyReportMsg(report)
               : customMsg;
    if (!text.trim()) { setMsg('Message is empty'); return; }

    // Normalize phone - add India +91 if not present
    const rawPhone = report.student.parentPhone.replace(/\D/g, '');
    const phone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setMsg(`✅ WhatsApp opened for ${report.student.parentPhone} — click Send in WhatsApp to deliver the message.`);
  };

  const statusColor = s => ({ present: '#10b981', absent: '#ef4444', late: '#f59e0b' }[s] || '#9ca3af');
  const statusLabel = s => ({ present: 'P', absent: 'A', late: 'L', no_class: '—' }[s] || '?');
  const pct = report?.attendance?.percentage || 0;
  const pctColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: '0 0 6px' }}>📊 Student Reports & WhatsApp Notifications</h3>
      <p style={{ fontSize: 13, color: T.muted, margin: '0 0 20px' }}>
        View weekly performance report for any student and send attendance/report notifications to their parents via WhatsApp.
      </p>

      {/* Student Selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Student</label>
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); loadReport(e.target.value); }}
            style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.ib}`, background: T.input, color: T.text, fontSize: 14, outline: 'none' }}
          >
            <option value=''>— Choose a student —</option>
            {students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.email})</option>)}
          </select>
        </div>
        {selectedId && (
          <button onClick={() => loadReport(selectedId)} disabled={loading}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
            {loading ? '⏳ Loading...' : '📊 Load Report'}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px', color: T.muted }}>⏳ Loading report...</div>
      )}

      {/* Report Display */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Student Info Banner */}
          <div style={{ background: T.input, border: `1px solid ${T.ib}`, borderRadius: 12, padding: 16, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
              {(report.student?.name || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{report.student?.name}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{report.student?.email}</div>
            </div>
            <div style={{ fontSize: 13, color: T.muted }}>
              👨‍👩‍👦 Parent: <strong style={{ color: T.text }}>{report.student?.parentName || '—'}</strong>
            </div>
            <div style={{ fontSize: 13, color: T.muted }}>
              📱 <strong style={{ color: report.student?.parentPhone ? T.text : '#ef4444' }}>
                {report.student?.parentPhone || 'Not set — ask student to update Profile'}
              </strong>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Attendance',  value: `${pct}%`,                      color: pctColor,   icon: '📅' },
              { label: 'Present',     value: report.attendance?.present || 0, color: '#10b981',  icon: '✅' },
              { label: 'Absent',      value: report.attendance?.absent || 0,  color: '#ef4444',  icon: '❌' },
              { label: 'Assignments', value: report.assignments?.submitted || 0, color: '#6366f1', icon: '📝' },
            ].map((s, i) => (
              <div key={i} style={{ background: T.input, border: `1px solid ${T.ib}`, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Attendance Bar */}
          <div style={{ background: T.input, border: `1px solid ${T.ib}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 10 }}>📊 Weekly Attendance Rate</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 12, background: T.border, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg,${pctColor},${pctColor}bb)`, transition: 'width 0.8s ease' }} />
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: pctColor, minWidth: 52 }}>{pct}%</span>
            </div>
          </div>

          {/* Daily Attendance Chips */}
          <div style={{ background: T.input, border: `1px solid ${T.ib}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 12 }}>📅 Daily Attendance — This Week</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(report.attendance?.days || []).map((day, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 48 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{day.day}</div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: statusColor(day.status) + '22', border: `2px solid ${statusColor(day.status)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: statusColor(day.status) }}>
                    {statusLabel(day.status)}
                  </div>
                  <div style={{ fontSize: 9, color: T.muted }}>{day.date?.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Send Section */}
          <div style={{ background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 14 }}>📱 Send WhatsApp Notification to Parent</div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { key: 'attendance', label: '📅 Attendance Alert' },
                { key: 'report',     label: '📈 Weekly Report' },
                { key: 'custom',     label: '✏️ Custom Message' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setSendMode(opt.key)}
                  style={{ padding: '8px 16px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: sendMode === opt.key ? '#10b981' : '#d1fae5', color: sendMode === opt.key ? '#fff' : '#065f46', transition: 'all 0.15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Message Preview */}
            {sendMode !== 'custom' && (
              <div style={{ background: '#fff', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Message Preview</div>
                <pre style={{ fontSize: 12, color: '#1e293b', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7 }}>
                  {sendMode === 'attendance' ? buildAttendanceMsg(report) : buildWeeklyReportMsg(report)}
                </pre>
              </div>
            )}

            {/* Custom Message */}
            {sendMode === 'custom' && (
              <textarea
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
                placeholder="Type your custom WhatsApp message here..."
                rows={6}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #10b981', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 14, boxSizing: 'border-box', background: '#fff' }}
              />
            )}

            {/* Open WhatsApp Button */}
            <button
              onClick={openWhatsApp}
              disabled={!report?.student?.parentPhone}
              style={{ padding: '11px 28px', borderRadius: 10, border: 'none', background: report?.student?.parentPhone ? 'linear-gradient(135deg,#25D366,#128C7E)' : '#9ca3af', color: '#fff', fontSize: 14, fontWeight: 700, cursor: report?.student?.parentPhone ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              📱 Open WhatsApp & Send
            </button>
            {report?.student?.parentPhone && (
              <div style={{ fontSize: 12, color: '#065f46', marginTop: 8 }}>
                ℹ️ WhatsApp Web/App opens with message pre-filled — just click <strong>Send</strong> once.
              </div>
            )}

            {!report?.student?.parentPhone && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 10, fontWeight: 600 }}>
                ⚠️ Parent phone not set. Ask student to go to Profile → Parent Details tab and add their parent's WhatsApp number.
              </div>
            )}
          </div>

          {/* Status Message */}
          {msg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.startsWith('✅') ? '#f0fdf4' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#dc2626', border: `1px solid ${msg.startsWith('✅') ? '#10b981' : '#fca5a5'}` }}>
              {msg}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function AdminGroupChat({ user, token }) {
  const { isDark } = useTheme();
  const T = {
    bg:       isDark ? '#0f0f1a' : '#f0f4f8',
    sidebar:  isDark ? '#13131f' : '#1e3a5f',
    card:     isDark ? '#1a1a2e' : '#ffffff',
    border:   isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    text:     isDark ? '#f1f5f9' : '#1e293b',
    textSub:  isDark ? '#94a3b8' : '#64748b',
    textMuted:isDark ? '#64748b' : '#94a3b8',
    input:    isDark ? '#0f0f1a' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    rowHover: isDark ? '#1e1e35' : '#f4f6fb',
    accent:   '#1e3a5f',
    accentBg: isDark ? 'rgba(30,58,95,0.3)' : '#e6f0fb',
  };

  const [courses,    setCourses]    = useState([]);
  const [courseId,   setCourseId]   = useState('');
  const [messages,   setMessages]   = useState([]);
  const [text,       setText]       = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [loading,    setLoading]    = useState(false);
  const [sending,    setSending]    = useState(false);
  const [connected,  setConnected]  = useState(false);
  const [typing,     setTyping]     = useState(null);
  const [showVis,    setShowVis]    = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const typTimer   = useRef(null);
  const socketRef  = useRef(null);

  const myId   = user?._id || user?.id;
  const myName = user?.name || 'Admin';
  const myRole = user?.role || 'admin';

  // load courses — use active-course endpoint to guarantee same courseId as trainees
  useEffect(() => {
    // First get the canonical courseId that matches trainee's enrolled course
    api.get(`${API}/api/chat/active-course`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.data?.courseId) setCourseId(r.data.courseId);
      })
      .catch(() => {});
    // Also load all courses for the dropdown
    api.get(`${API}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCourses(r.data || []))
      .catch(() => {});
  }, []);

  // load messages
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    api.get(`${API}/api/chat/${courseId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setMessages(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  // socket
  useEffect(() => {
    if (!courseId || !myId) return;

    // Always create a fresh socket for this course room
    if (socketRef.current) {
      socketRef.current.emit('leave-course-chat', { courseId });
      socketRef.current.disconnect();
    }
    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      auth: { token },
    });
    socketRef.current = s;

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMsg        = (msg) => {
      // admin sees everything
      setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
    };
    const onDeleted    = ({ _id }) => setMessages(prev => prev.filter(m => m._id !== _id));
    const onTyping     = ({ userName: n }) => {
      if (n !== myName) {
        setTyping(n);
        clearTimeout(typTimer.current);
        typTimer.current = setTimeout(() => setTyping(null), 3000);
      }
    };

    s.on('connect',              onConnect);
    s.on('disconnect',           onDisconnect);
    s.on('chat-message',         onMsg);
    s.on('chat-message-deleted', onDeleted);
    s.on('user-typing',          onTyping);

    s.emit('join-course-chat', { courseId, userId: myId, userName: myName, userRole: myRole });
    setConnected(s.connected);

    return () => {
      s.off('connect',              onConnect);
      s.off('disconnect',           onDisconnect);
      s.off('chat-message',         onMsg);
      s.off('chat-message-deleted', onDeleted);
      s.off('user-typing',          onTyping);
      s.emit('leave-course-chat', { courseId });
      s.disconnect();
      socketRef.current = null;
    };
  }, [courseId, myId]);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = () => {
    const msg = text.trim();
    if (!msg || sending || !courseId) return;
    setSending(true);
    socketRef.current?.emit('send-chat-message', {
      courseId,
      senderId:   myId,
      senderName: myName,
      senderRole: myRole,
      message:    msg,
      visibility,
    });
    socketRef.current?.emit('stop-typing', { courseId });
    setText('');
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMsg = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`${API}/api/chat/${courseId}/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch { alert('Cannot delete'); }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socketRef.current?.emit('typing', { courseId, userName: myName });
    clearTimeout(typTimer.current);
    typTimer.current = setTimeout(() => socketRef.current?.emit('stop-typing', { courseId }), 1500);
  };

  const currentVis = VIS_OPTIONS.find(v => v.value === visibility);

  return (
    <div style={{ ...S.card, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 280px)', minHeight: 340 }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ ...S.cardTitle, margin: 0 }}>💬 Group Chat</h3>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#1D9E75' : '#e74c3c', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>{connected ? 'Live' : 'Connecting…'}</span>

        {courses.length >= 1 && (
          <select value={courseId} onChange={e => setCourseId(e.target.value)}
            style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
            <option value="">— Select course —</option>
            {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        )}
      </div>

      {!courseId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
          {courses.length === 0 ? '⏳ Loading courses…' : '📋 Select a course above or enter a Course ID at the top to open chat'}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>⏳ Loading messages…</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>No messages yet. Start the conversation! 👋</div>
            ) : (
              messages.map((msg, i) => {
                const isMe     = msg.senderId?.toString() === myId?.toString();
                const prev     = messages[i - 1];
                const showMeta = !prev || prev.senderId?.toString() !== msg.senderId?.toString() ||
                  new Date(msg.createdAt) - new Date(prev.createdAt) > 300000;

                const visBadge = msg.visibility !== 'everyone'
                  ? VIS_OPTIONS.find(v => v.value === msg.visibility) : null;

                return (
                  <div key={msg._id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginTop: showMeta ? 12 : 2 }}>
                    {!isMe && showMeta && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: roleColor(msg.senderRole), color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(msg.senderName || '?')[0].toUpperCase()}
                      </div>
                    )}
                    {!isMe && !showMeta && <div style={{ width: 32, flexShrink: 0 }} />}

                    <div style={{ maxWidth: '65%' }}>
                      {showMeta && (
                        <div style={{ fontSize: 12, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: roleColor(msg.senderRole), fontWeight: 700 }}>
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          {msg.senderRole !== 'student' && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: roleColor(msg.senderRole), color: '#fff', fontWeight: 600 }}>
                              {msg.senderRole}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        <div style={{ padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word', position: 'relative', background: isMe ? '#e74c3c' : '#f0f0f0', color: isMe ? '#fff' : '#222' }}>
                          {msg.message}
                          {/* Admin can delete any message */}
                          <button onClick={() => deleteMsg(msg._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 0 0 8px', verticalAlign: 'middle', color: isMe ? 'rgba(255,255,255,0.5)' : '#ccc' }}
                            title="Delete">×</button>
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{fmtTime(msg.createdAt)}</div>
                      </div>
                      {visBadge && (
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                          {visBadge.label}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {typing && (
              <div style={{ fontSize: 12, color: T.textMuted, padding: '6px 4px' }}>✏️ {typing} is typing…</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>Send to:</span>
              <button onClick={() => setShowVis(v => !v)}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}>
                {currentVis.label} ▾
              </button>
              <span style={{ fontSize: 11, color: T.textMuted }}>{currentVis.desc}</span>
              {showVis && (
                <div style={{ position: 'absolute', bottom: '130%', left: 64, background: T.card, border: '1px solid #ddd', borderRadius: 12, padding: 8, zIndex: 999, minWidth: 240, boxShadow: '0 4px 20px #0002' }}>
                  {VIS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setVisibility(opt.value); setShowVis(false); }}
                      style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: visibility === opt.value ? '#fdecea' : 'transparent', color: visibility === opt.value ? '#e74c3c' : '#333', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: visibility === opt.value ? 700 : 400, borderRadius: 8, marginBottom: 2 }}>
                      {opt.label}
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input ref={inputRef} value={text} onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Type a message… (Enter to send)"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
                disabled={sending}
              />
              <button onClick={send} disabled={sending || !text.trim()}
                style={{ width: 48, height: 48, borderRadius: '50%', background: '#e74c3c', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>
                {sending ? '…' : '➤'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const S = {
  appWrapper:    { display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingTop: 56, overflowX: 'hidden' },
  sidebar:       { width: 230, display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 8 },
  sidebarName:   { color: '#fff', fontWeight: 700, fontSize: 14 },
  sidebarRole:   { color: '#93c5fd', fontSize: 11, marginTop: 2, background: 'rgba(147,197,253,0.15)', padding: '2px 8px', borderRadius: 20, display: 'inline-block', fontWeight: 600 },
  avatarCircle:  { width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  navBtn:        { width: '100%', padding: '11px 14px 11px 20px', background: 'none', border: 'none', borderLeft: '3px solid transparent', color: 'rgba(255,255,255,0.5)', textAlign: 'left', cursor: 'pointer', fontSize: 13.5, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 },
  navBtnActive:  { background: 'rgba(255,255,255,0.1)', color: '#fff', borderLeft: '3px solid #60a5fa' },
  page:          { flex: 1, minHeight: '100vh', padding: 28, paddingTop: 84, overflowY: 'auto' },
  header:        { marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:         { fontSize: 22, fontWeight: 800, margin: 0 },
  sub:           { fontSize: 13, margin: '4px 0 0 0' },
  topRow:        { display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, padding: 16, borderRadius: 14 },
  field:         { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 },
  label:         { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:         { padding: '9px 12px', border: '1.5px solid', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  loadBtn:       { padding: '9px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-end' },
  tabs:          { display: 'flex', gap: 8, marginBottom: 16 },
  tab:           { padding: '10px 22px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  tabActive:     { background: '#1e3a5f', color: '#fff', fontWeight: 700 },
  secTabs:       { display: 'flex', borderRadius: '12px 12px 0 0', borderBottom: '1px solid' },
  secTab:        { flex: 1, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secDot:        { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  chip:          { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  card:          { borderRadius: '0 0 14px 14px', padding: 20, marginBottom: 16 },
  cardTitle:     { fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' },
  secDesc:       { fontSize: 13, margin: 0 },
  addRowBtn:     { padding: '7px 14px', border: '1.5px solid', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  saveBtn:       { padding: '8px 20px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  msgBox:        { padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 },
  qGrid:         { display: 'flex', flexDirection: 'column', border: '1px solid', borderRadius: 10, overflow: 'hidden' },
  qGridHeader:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  qRow:          { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: '1px solid' },
  qNum:          { width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  qInput:        { flex: 1, border: '1.5px solid', borderRadius: 7, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
  marksInput:    { width: 64, border: '1.5px solid', borderRadius: 7, padding: '7px 8px', fontSize: 13, textAlign: 'center', outline: 'none' },
  delRowBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#bbb', padding: 4 },
  secBadge:      { color: '#fff', padding: '5px 12px', borderRadius: '7px 7px 0 0', fontSize: 12, fontWeight: 700 },
  savedQ:        { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid' },
  warning:       { background: '#FFF8E1', color: '#E65100', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  uploadBox:     { border: '2px dashed', borderRadius: 10, padding: 20, marginBottom: 16, textAlign: 'center' },
  subSummary:    { display: 'flex', gap: 20, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 8 },
  subHeader:     { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', transition: 'background 0.15s', cursor: 'pointer' },
  traineeAvatar: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#1D9E75,#185FA5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 },
  scoreBreakdown:{ display: 'flex', gap: 24, borderRadius: 10, padding: '14px 20px', marginBottom: 16, marginTop: 12 },
  ansSecTab:     { padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' },
  answerCard:    { borderRadius: 10, padding: '12px 14px', border: '1px solid' },
};
// ════════════════════════════════════════════════════════════
//  ADMIN SESSION TRACKER COMPONENT
// ════════════════════════════════════════════════════════════
function AdminSessionTracker({ token }) {
  const { isDark } = useTheme();
  const [sessions,  setSessions]  = React.useState([]);
  const [summary,   setSummary]   = React.useState([]);
  const [users,     setUsers]     = React.useState([]);
  const [loading,   setLoading]   = React.useState(false);
  const [view,      setView]      = React.useState("summary"); // "summary" | "detail"
  const [filterUser, setFilterUser] = React.useState("");
  const [filterRole, setFilterRole] = React.useState("");
  const [fromDate,  setFromDate]  = React.useState("");
  const [toDate,    setToDate]    = React.useState("");

  const T = {
    card:   isDark ? "#1a1a2e" : "#ffffff",
    text:   isDark ? "#f0f0f0" : "#1e293b",
    muted:  isDark ? "#94a3b8" : "#64748b",
    border: isDark ? "#2a2a3e" : "#e2e8f0",
    input:  isDark ? "#242438" : "#f8fafc",
    ib:     isDark ? "#3a3a50" : "#cbd5e1",
    row:    isDark ? "#1e1e35" : "#f8fafc",
  };

  const hdr = { Authorization: `Bearer ${token}` };
  const API2 = "https://codemedha-production-47c1.up.railway.app";

  const fmtDateTime = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true
    });
  };
  const fmtDuration = (mins) => {
    if (mins == null || mins <= 0) return "—";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const roleColor = (r) => ({
    student: "#10b981", trainer: "#8b5cf6", teacher: "#8b5cf6"
  }[r] || "#64748b");

  const roleLabel = (r) => ({
    student: "Trainee", trainer: "Trainer", teacher: "Trainer"
  }[r] || r);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${API2}/api/sessions/summary`, { headers: hdr });
      setSummary(res.data || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get(`${API2}/api/sessions/users`, { headers: hdr });
      setUsers(res.data || []);
    } catch (e) {}
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.append("userId", filterUser);
      if (filterRole) params.append("role", filterRole);
      if (fromDate)   params.append("from", fromDate);
      if (toDate)     params.append("to", toDate);
      const res = await api.get(`${API2}/api/sessions/all?${params}`, { headers: hdr });
      setSessions(res.data || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  React.useEffect(() => {
    loadSummary();
    loadUsers();
  }, []);

  React.useEffect(() => {
    if (view === "detail") loadSessions();
  }, [view]);

  const totalOnline   = summary.filter(s => s.currentlyOnline).length;
  const totalTrainers = summary.filter(s => ['trainer','teacher'].includes(s.user.role)).length;
  const totalTrainees = summary.filter(s => s.user.role === "student").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>🕐 Login / Logout Tracker</h3>
            <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>Trainee & Trainer website login time and exit time — admin view</p>
          </div>
          <button onClick={() => { loadSummary(); if (view === "detail") loadSessions(); }}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#1e3a5f", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            🔄 Refresh
          </button>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 }}>
          {[
            { label: "Currently Online", value: totalOnline,   color: "#10b981", icon: "🟢" },
            { label: "Trainers",          value: totalTrainers, color: "#8b5cf6", icon: "👨‍💻" },
            { label: "Trainees",          value: totalTrainees, color: "#10b981", icon: "🎓" },
          ].map((c, i) => (
            <div key={i} style={{ background: T.input, border: `1px solid ${T.ib}`, borderRadius: 12, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { key: "summary", label: "👥 User Summary" },
          { key: "detail",  label: "📋 Session Log"  },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            style={{ padding: "10px 22px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: view === v.key ? "#1e3a5f" : T.card,
              color: view === v.key ? "#fff" : T.muted,
              border: `1px solid ${T.border}` }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── SUMMARY VIEW ─────────────────────────────────────── */}
      {view === "summary" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 2fr 1fr", padding: "10px 16px",
            background: isDark ? "#13131f" : "#f1f5f9", fontSize: 11, fontWeight: 700, color: T.muted,
            textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${T.border}` }}>
            <div>User</div>
            <div>Role</div>
            <div>Sessions</div>
            <div>Avg Time</div>
            <div>Last Login</div>
            <div>Last Logout</div>
            <div>Status</div>
          </div>
          {loading && <div style={{ padding: 32, textAlign: "center", color: T.muted }}>⏳ Loading...</div>}
          {!loading && summary.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: T.muted }}>No session data yet. Sessions appear after trainer/trainee logins.</div>
          )}
          {summary.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 2fr 1fr",
              padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
              background: s.currentlyOnline ? (isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4") : "transparent",
              alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{s.user.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{s.user.email}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: roleColor(s.user.role) + "22", color: roleColor(s.user.role) }}>
                  {roleLabel(s.user.role)}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{s.totalSessions}</div>
              <div style={{ fontSize: 13, color: T.text }}>{fmtDuration(s.avgMinutes)}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{fmtDateTime(s.lastLogin)}</div>
              <div style={{ fontSize: 12, color: s.currentlyOnline ? "#10b981" : T.muted }}>
                {s.currentlyOnline ? "Still online..." : fmtDateTime(s.lastLogout)}
              </div>
              <div>
                {s.currentlyOnline
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }}/> Online</span>
                  : <span style={{ fontSize: 11, color: T.muted }}>Offline</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DETAIL SESSION LOG ───────────────────────────────── */}
      {view === "detail" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filters */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>User</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.ib}`, background: T.input, color: T.text, fontSize: 13, outline: "none" }}>
                <option value="">All Users</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Role</label>
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.ib}`, background: T.input, color: T.text, fontSize: 13, outline: "none" }}>
                <option value="">All Roles</option>
                <option value="trainer">Trainer</option>
                <option value="student">Trainee</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.ib}`, background: T.input, color: T.text, fontSize: 13, outline: "none" }}/>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.ib}`, background: T.input, color: T.text, fontSize: 13, outline: "none" }}/>
            </div>
            <button onClick={loadSessions} disabled={loading}
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#1e3a5f", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {loading ? "⏳" : "🔍 Search"}
            </button>
          </div>

          {/* Session table */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 2fr 1fr 1fr", padding: "10px 16px",
              background: isDark ? "#13131f" : "#f1f5f9", fontSize: 11, fontWeight: 700, color: T.muted,
              textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${T.border}` }}>
              <div>User</div>
              <div>Role</div>
              <div>Login Time</div>
              <div>Logout / Exit Time</div>
              <div>Duration</div>
              <div>Status</div>
            </div>
            {loading && <div style={{ padding: 32, textAlign: "center", color: T.muted }}>⏳ Loading sessions...</div>}
            {!loading && sessions.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: T.muted }}>No sessions found. Try adjusting filters.</div>
            )}
            {sessions.map((s, i) => {
              const online = !s.logoutAt;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 2fr 1fr 1fr",
                  padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
                  background: online ? (isDark ? "rgba(16,185,129,0.05)" : "#f0fdf4") : "transparent",
                  alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{s.userId?.name || "—"}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{s.userId?.email || ""}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: roleColor(s.role) + "22", color: roleColor(s.role) }}>
                      {roleLabel(s.role)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.text }}>{fmtDateTime(s.loginAt)}</div>
                  <div style={{ fontSize: 12, color: online ? "#10b981" : T.muted }}>
                    {online ? "Still online..." : fmtDateTime(s.logoutAt)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {online ? "—" : fmtDuration(s.duration)}
                  </div>
                  <div>
                    {online
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }}/> Online</span>
                      : <span style={{ fontSize: 11, color: T.muted }}>✅ Done</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: T.muted, textAlign: "right" }}>{sessions.length} session(s) found</div>
        </div>
      )}
    </div>
  );
}