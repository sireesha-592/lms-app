import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API = 'https://codemedha-production-47c1.up.railway.app/api';
const SOCKET_URL = 'http://localhost:5000';

const token = () => localStorage.getItem('token');
const headers = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const roleColor = (role) =>
  role === 'admin' ? '#e74c3c' : role === 'teacher' || role === 'trainer' ? '#8e44ad' : '#2980b9';

const roleLabel = (role) =>
  role === 'admin' ? '👑 Admin' : role === 'teacher' || role === 'trainer' ? '🎓 Trainer' : '👤 Student';

// ── canSee helper (mirrors GroupChatPage) ────────────────────
const canSee = (msg, user) => {
  if (!user) return false;
  const role = user.role || 'student';
  const uid  = user._id || user.id;
  if (role === 'admin') return true;
  if (msg.visibility === 'everyone') return true;
  if (msg.visibility === 'trainer' && (role === 'teacher' || role === 'trainer')) return true;
  if ((msg.visibility === 'trainer' || msg.visibility === 'admin') &&
      (msg.senderId === uid || msg.senderId?.toString() === uid)) return true;
  return false;
};

const VIS_OPTIONS = [
  { value: 'everyone', label: '🌐 Everyone',    color: '#00d4aa' },
  { value: 'trainer',  label: '👨‍🏫 Trainer only', color: '#7c6af5' },
  { value: 'admin',    label: '🔒 Admin only',   color: '#f5a623' },
];

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ════════════════════════════════════════════════════════════
//  MAIN TRAINER PANEL
// ════════════════════════════════════════════════════════════
let socketInstance = null;

export default function TrainerPanel() {
  const [tab, setTab]       = useState('dashboard');
  const [dark, setDark]     = useState(() => localStorage.getItem('tp_dark') === 'true');
  const user = JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');

  const toggleDark = () => setDark(d => { localStorage.setItem('tp_dark', !d); return !d; });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard',     icon: '📊' },
    { id: 'attendance', label: 'Attendance',   icon: '✅' },
    { id: 'grading',   label: 'Grading',       icon: '📝' },
    { id: 'students',  label: 'Students',      icon: '👥' },
    { id: 'notes',     label: 'Session Notes', icon: '📓' },
    { id: 'doubts',    label: 'Doubt Tracker', icon: '❓' },
    { id: 'resources', label: 'Resources',     icon: '📎' },
    { id: 'chat',      label: 'Group Chat',    icon: '💬' },
  ];

  const now   = new Date();
  const hour  = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const currentTab = tabs.find(t => t.id === tab);

  // Dark mode tokens
  const dm = dark ? {
    pageBg:      '#0f172a',
    sidebarBg:   'linear-gradient(180deg,#020617 0%,#0f172a 100%)',
    headerBg:    '#1e293b',
    headerBorder:'#334155',
    headerText:  '#f1f5f9',
    headerSub:   '#94a3b8',
    dateBg:      '#1e293b',
    dateBorder:  '#334155',
    dateText:    '#94a3b8',
    contentBg:   '#0f172a',
  } : {
    pageBg:      '#f8fafc',
    sidebarBg:   'linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)',
    headerBg:    '#ffffff',
    headerBorder:'#f1f5f9',
    headerText:  '#1e1b4b',
    headerSub:   '#94a3b8',
    dateBg:      '#f8fafc',
    dateBorder:  '#e2e8f0',
    dateText:    '#64748b',
    contentBg:   '#f8fafc',
  };

  const accentColor  = '#00d4aa';
  const sidebarBg    = '#0d1118';
  const headerBg     = dark ? '#0d1118' : '#ffffff';
  const headerBorder = dark ? '#1e2535' : '#e2e8f0';
  const contentBg    = dark ? '#0a0d14' : '#f0f4f8';
  const headerText   = dark ? '#ffffff' : '#1a1a2e';
  const headerSub    = dark ? '#555'    : '#94a3b8';
  const navInactive  = dark ? '#555'    : '#7a8aa0';

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'DM Sans','Segoe UI',sans-serif", background: contentBg }}>
      <style>{`
        .tp-nav:hover { background: rgba(0,212,170,0.08) !important; color: #00d4aa !important; }
        aside::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ width:240, background:sidebarBg, display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, height:'100vh', overflowY:'auto', overflowX:'hidden', zIndex:200, scrollbarWidth:'none', borderRight:'1px solid #1e2535' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 18px 16px', borderBottom:'1px solid #1e2535' }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#00d4aa,#7c6af5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0 }}>C</div>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:15 }}>CodeMedha</div>
            <div style={{ color:accentColor, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2 }}>Trainer Portal</div>
          </div>
        </div>

        <div style={{ margin:'12px 10px', background:'rgba(0,212,170,0.06)', borderRadius:12, padding:'14px', textAlign:'center', border:'1px solid rgba(0,212,170,0.12)' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#00d4aa,#7c6af5)', color:'#fff', fontWeight:800, fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
            {(user.name||'T')[0].toUpperCase()}
          </div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:13, marginBottom:4 }}>{user.name||'Trainer'}</div>
          <div style={{ display:'inline-block', background:'rgba(0,212,170,0.15)', color:accentColor, fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>🎓 Trainer</div>
        </div>

        <nav style={{ flex:1, padding:'4px 8px' }}>
          {tabs.map(t => (
            <button key={t.id} className="tp-nav"
              style={{ width:'100%', padding:'10px 12px', background: tab===t.id ? 'rgba(0,212,170,0.1)' : 'none', border:'none', borderLeft: tab===t.id ? `3px solid ${accentColor}` : '3px solid transparent', color: tab===t.id ? accentColor : navInactive, textAlign:'left', cursor:'pointer', fontSize:13, fontWeight: tab===t.id ? 700 : 500, display:'flex', alignItems:'center', gap:10, transition:'all 0.15s', borderRadius:'0 8px 8px 0' }}
              onClick={() => setTab(t.id)}>
              <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0 }}>{t.icon}</span>
              <span>{t.label}</span>
              {tab===t.id && <span style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:accentColor }} />}
            </button>
          ))}
        </nav>

        <div style={{ padding:'12px 16px', borderTop:'1px solid #1e2535' }}>
          <div style={{ fontSize:11, color:'#444', textAlign:'center' }}>{now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex:1, marginLeft:240, display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* ── FIXED HEADER ── */}
        <div style={{ position:'fixed', top:0, left:240, right:0, zIndex:150, background:headerBg, borderBottom:`1px solid ${headerBorder}`, boxShadow: dark ? '0 1px 12px rgba(0,0,0,0.4)' : '0 1px 8px rgba(0,0,0,0.06)', padding:'0 24px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {tab !== 'dashboard' && (
              <button onClick={() => setTab('dashboard')} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:`1.5px solid ${headerBorder}`, background: dark ? '#1e2535' : '#f0f4f8', color: dark ? '#94a3b8' : '#64748b', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                ← Back
              </button>
            )}
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:headerText, display:'flex', alignItems:'center', gap:8 }}>
                <span>{currentTab?.icon}</span><span>{currentTab?.label}</span>
              </div>
              <div style={{ fontSize:11, color:headerSub, marginTop:1 }}>{greeting}, {(user.name||'Trainer').split(' ')[0]}! 👋</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:12, color: dark ? '#555' : '#94a3b8', fontWeight:600, background: dark ? '#1e2535' : '#f0f4f8', padding:'6px 14px', borderRadius:20, border:`1px solid ${headerBorder}` }}>
              📅 {now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
            </div>
            <button onClick={toggleDark} style={{ width:42, height:24, borderRadius:12, border:'none', cursor:'pointer', background: dark ? accentColor : '#e2e8f0', position:'relative', transition:'background 0.3s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:3, transition:'left 0.3s', left: dark ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>{dark ? '🌙' : '☀️'}</div>
            </button>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#00d4aa,#7c6af5)', color:'#fff', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {(user.name||'T')[0].toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex:1, padding:'28px 32px', marginTop:64, background:contentBg, minHeight:'calc(100vh - 64px)', overflowY:'auto' }}>
          {tab === 'dashboard'  && <Dashboard setTab={setTab} dark={dark} />}
          {tab === 'attendance' && <AttendanceTab dark={dark} />}
          {tab === 'grading'    && <GradingTab dark={dark} />}
          {tab === 'students'   && <StudentsTab dark={dark} />}
          {tab === 'notes'      && <SessionNotesTab dark={dark} />}
          {tab === 'doubts'     && <DoubtTrackerTab dark={dark} />}
          {tab === 'resources'  && <ResourcesTab dark={dark} />}
          {tab === 'chat'       && <GroupChatTab user={user} dark={dark} />}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
function Dashboard({ setTab, dark }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');

  useEffect(() => {
    axios.get(`${API}/trainer/dashboard`, headers())
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening';
  const todayStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const { totalStudents, attendance, submissions, hasAssignment } = stats || {};
  const attendancePct = totalStudents > 0 ? Math.round(((attendance?.present || 0) / totalStudents) * 100) : 0;

  const card  = dark ? '#1e293b' : '#fff';
  const cBord = dark ? '#334155' : '#f1f5f9';
  const cText = dark ? '#f1f5f9' : '#1e1b4b';
  const cSub  = dark ? '#94a3b8' : '#64748b';

  const quickActions = [
    { icon: '✅', label: 'Mark Attendance', color: '#10b981', bg: '#d1fae5', tab: 'attendance' },
    { icon: '📝', label: 'Grade Assignments', color: '#8b5cf6', bg: '#ede9fe', tab: 'grading' },
    { icon: '❓', label: 'Resolve Doubts', color: '#f59e0b', bg: '#fef3c7', tab: 'doubts' },
    { icon: '📓', label: 'Add Session Note', color: '#3b82f6', bg: '#dbeafe', tab: 'notes' },
    { icon: '📎', label: 'Share Resources', color: '#ef4444', bg: '#fee2e2', tab: 'resources' },
    { icon: '💬', label: 'Group Chat', color: '#06b6d4', bg: '#cffafe', tab: 'chat' },
  ];

  const tips = [
    '💡 Share session notes after every class so students can revise easily.',
    '🎯 Grade assignments within 24 hours for better student engagement.',
    '📊 Monitor attendance trends weekly to identify at-risk students.',
    '💬 Use the group chat to send motivational messages to your batch.',
    '📎 Upload reference PDFs and docs to the Resources tab for easy access.',
  ];
  const tip = tips[now.getDay() % tips.length];

  return (
    <div>
      {/* ── WELCOME BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #061a14 0%, #0a2d24 40%, #0d3d2e 100%)',
        borderRadius: 20, padding: '36px 40px', marginBottom: 28, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(0,212,170,0.15)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, right:120, width:120, height:120, borderRadius:'50%', background:'rgba(124,106,245,0.12)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:20, right:200, width:60, height:60, borderRadius:'50%', background:'rgba(0,212,170,0.08)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'rgba(0,212,170,0.7)', textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
            {greeting}
          </div>
          <h1 style={{ fontSize:30, fontWeight:800, color:'#fff', margin:'0 0 8px', lineHeight:1.2 }}>
            Welcome back, {(user.name || 'Trainer').split(' ')[0]}! 🚀
          </h1>
          <p style={{ fontSize:14, color:'rgba(0,212,170,0.6)', margin:'0 0 24px', maxWidth:480 }}>
            {todayStr} — Your students are counting on you. Let's make today count!
          </p>

          {/* Inline quick stats */}
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            {[
              { label:'Total Students', value: loading ? '…' : (totalStudents ?? 0), icon:'👥', color:'#00d4aa' },
              { label:'Present Today',  value: loading ? '…' : (attendance?.present ?? '—'), icon:'✅', color:'#6ee7b7' },
              { label:'Absent Today',   value: loading ? '…' : (attendance?.absent ?? '—'), icon:'❌', color:'#fca5a5' },
              { label:'Attendance',     value: loading ? '…' : `${attendancePct}%`, icon:'📊', color:'#fde68a' },
            ].map((s,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(4px)', borderRadius:12, padding:'12px 20px', minWidth:110 }}>
                <div style={{ fontSize:11, color:'#c4b5fd', marginBottom:4 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TIP OF THE DAY ── */}
      <div style={{ background: dark ? '#1c1a0a' : 'linear-gradient(90deg,#fef9c3,#fef3c7)', border:`1px solid ${dark?'#854d0e':'#fde68a'}`, borderRadius:12, padding:'12px 20px', marginBottom:28, display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>💡</span>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color: dark?'#fbbf24':'#92400e', textTransform:'uppercase', letterSpacing:1 }}>Tip of the Day</div>
          <div style={{ fontSize:14, color: dark?'#fde68a':'#78350f', marginTop:2 }}>{tip.replace('💡 ','')}</div>
        </div>
      </div>

      {/* ── STAT CARDS ROW ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
        {[
          { icon:'👥', label:'Total Students', value: loading ? '…' : (totalStudents ?? 0), color:'#6366f1', bg: dark?'#1e1b4b':'#eef2ff', trend:'+2 this week' },
          { icon:'✅', label:'Present Today',  value: loading ? '…' : (attendance?.present ?? '—'), color:'#10b981', bg: dark?'#052e16':'#ecfdf5', trend:`${attendancePct}% rate` },
          { icon:'❌', label:'Absent Today',   value: loading ? '…' : (attendance?.absent ?? '—'), color:'#ef4444', bg: dark?'#2d0a0a':'#fef2f2', trend:'needs follow-up' },
          { icon:'⏳', label:'Not Marked',     value: loading ? '…' : (attendance?.notMarked ?? '—'), color:'#f59e0b', bg: dark?'#1c1100':'#fffbeb', trend:'mark now' },
          { icon:'📤', label:'Submitted',      value: loading ? '…' : (hasAssignment ? (submissions?.submitted ?? 0) : '—'), color:'#8b5cf6', bg: dark?'#1e1040':'#f5f3ff', trend:'assignments' },
          { icon:'🔖', label:'To Grade',       value: loading ? '…' : (hasAssignment ? (submissions?.ungraded ?? 0) : '—'), color:'#ec4899', bg: dark?'#2d0a1a':'#fdf2f8', trend:'pending review' },
        ].map((c,i) => (
          <div key={i} style={{ background: card, borderRadius:14, padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.1)', border:`1px solid ${cBord}`, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-10, right:-10, width:70, height:70, borderRadius:'50%', background:c.bg, opacity:0.6 }} />
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:12 }}>{c.icon}</div>
              <div style={{ fontSize:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
              <div style={{ fontSize:13, color: cSub, marginTop:4, fontWeight:600 }}>{c.label}</div>
              <div style={{ fontSize:11, color:c.color, marginTop:6, background:c.bg, display:'inline-block', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>{c.trend}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ marginBottom:28 }}>
        <h3 style={{ fontSize:16, fontWeight:700, color: cText, marginBottom:14 }}>⚡ Quick Actions</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          {quickActions.map((a,i) => (
            <button key={i} onClick={() => setTab(a.tab)}
              style={{ background: card, border:`1.5px solid ${cBord}`, borderRadius:14, padding:'18px 16px', cursor:'pointer', textAlign:'center', transition:'all 0.2s', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${a.color}33`; e.currentTarget.style.borderColor=a.color+'44'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor=cBord; }}>
              <div style={{ width:44, height:44, borderRadius:12, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 10px' }}>{a.icon}</div>
              <div style={{ fontSize:13, fontWeight:600, color:a.color }}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── TODAY'S ASSIGNMENT STATUS ── */}
      <div style={{ background: card, borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.08)', border:`1px solid ${cBord}` }}>
        <h3 style={{ fontSize:16, fontWeight:700, color: cText, margin:'0 0 16px' }}>📋 Today's Assignment Status</h3>
        {loading ? <Loader /> : !hasAssignment ? (
          <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📭</div>
            <div style={{ fontSize:15, fontWeight:600 }}>No assignment scheduled for today</div>
            <div style={{ fontSize:13, marginTop:4 }}>Create one from the Admin panel to track submissions</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { label:'Submitted', value: submissions?.submitted ?? 0, color:'#8b5cf6', icon:'📤', bg: dark?'#1e1040':'#f5f3ff' },
              { label:'Pending',   value: submissions?.pending   ?? 0, color:'#f59e0b', icon:'📭', bg: dark?'#1c1100':'#fffbeb' },
              { label:'Ungraded',  value: submissions?.ungraded  ?? 0, color:'#ef4444', icon:'🔖', bg: dark?'#2d0a0a':'#fef2f2' },
            ].map((s,i) => (
              <div key={i} style={{ background:s.bg, borderRadius:12, padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:28 }}>{s.icon}</div>
                <div style={{ fontSize:26, fontWeight:800, color:s.color, margin:'4px 0' }}>{s.value}</div>
                <div style={{ fontSize:12, color: cSub, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ color, icon, label, value }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'20px 16px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', borderTop:`4px solid ${color}` }}>
      <div style={{ fontSize:32 }}>{icon}</div>
      <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
      <div style={{ color:'#666', fontSize:13, marginTop:4 }}>{label}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ATTENDANCE TAB
// ════════════════════════════════════════════════════════════
function AttendanceTab() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState({});
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/trainer/attendance?date=${date}`, headers())
      .then(r => {
        setData(r.data.attendance || []);
        const map = {};
        (r.data.attendance || []).forEach(a => { map[a.student._id] = a.status; });
        setLocalStatus(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const markOne = (studentId, status) => setLocalStatus(prev => ({ ...prev, [studentId]: status }));

  const saveOne = async (studentId) => {
    try {
      await axios.post(`${API}/trainer/attendance/mark`, { studentId, date, status: localStatus[studentId] || 'absent' }, headers());
      showToast('✅ Saved!');
    } catch { showToast('❌ Error saving'); }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const records = data.map(d => ({
        studentId: d.student._id,
        status: localStatus[d.student._id] || 'not_marked',
      })).filter(r => r.status !== 'not_marked');
      await axios.post(`${API}/trainer/attendance/bulk`, { date, records }, headers());
      showToast(`✅ ${records.length} records saved!`);
      load();
    } catch { showToast('❌ Error saving'); }
    finally { setSaving(false); }
  };

  const markAllPresent = () => {
    const map = {};
    data.forEach(d => { map[d.student._id] = 'present'; });
    setLocalStatus(map);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const presentCount = Object.values(localStatus).filter(s => s === 'present').length;
  const absentCount  = Object.values(localStatus).filter(s => s === 'absent').length;

  return (
    <div>
      <h2 style={styles.pageTitle}>✅ Attendance Management</h2>
      {toast && <div style={styles.toast}>{toast}</div>}
      <div style={styles.toolbar}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.dateInput} />
        <button onClick={markAllPresent} style={{ ...styles.btn, background: '#27ae60' }}>✅ Mark All Present</button>
        <button onClick={saveAll} disabled={saving} style={{ ...styles.btn, background: '#3498db' }}>
          {saving ? '💾 Saving…' : '💾 Save All'}
        </button>
        <span style={styles.summaryBadge}>✅ {presentCount} | ❌ {absentCount}</span>
      </div>
      {loading ? <Loader /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Watched</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const st = localStatus[row.student._id] || row.status;
                return (
                  <tr key={row.student._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <strong>{row.student.name}</strong>
                      <div style={{ fontSize: 12, color: '#888' }}>{row.student.email}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.statusBtns}>
                        {['present', 'absent'].map(s => (
                          <button key={s} onClick={() => markOne(row.student._id, s)}
                            style={{ ...styles.statusBtn, background: st === s ? (s === 'present' ? '#27ae60' : '#e74c3c') : '#eee', color: st === s ? '#fff' : '#333' }}>
                            {s === 'present' ? '✅ Present' : '❌ Absent'}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={styles.td}>{row.watchedDuration ? `${row.watchedDuration} min` : '—'}</td>
                    <td style={styles.td}><button onClick={() => saveOne(row.student._id)} style={styles.smallBtn}>Save</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  GRADING TAB
// ════════════════════════════════════════════════════════════
function GradingTab() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setSelected(null);
    axios.get(`${API}/trainer/submissions?date=${date}`, headers())
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const onGraded = (updatedSub) => {
    setData(prev => ({ ...prev, submissions: prev.submissions.map(s => s._id === updatedSub._id ? updatedSub : s) }));
    showToast('✅ Graded & saved!');
    setSelected(null);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h2 style={styles.pageTitle}>📝 Assignment Grading</h2>
      {toast && <div style={styles.toast}>{toast}</div>}
      <div style={styles.toolbar}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...styles.dateInput, colorScheme: 'light', color: '#333' }} />
      </div>
      {!data?.assignment ? (
        <div style={styles.noData}>📭 No assignment found for {date}</div>
      ) : selected ? (
        <GradeForm submission={selected} questions={data.assignment.questions} onBack={() => setSelected(null)} onSaved={onGraded} />
      ) : (
        <>
          <div style={{ marginBottom: 12, color: '#555' }}>📋 <strong>{data.assignment.title}</strong> — {data.submissions.length} submissions</div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th><th style={styles.th}>Student</th>
                  <th style={styles.th}>Submitted</th><th style={styles.th}>Score</th>
                  <th style={styles.th}>Status</th><th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((sub, i) => (
                  <tr key={sub._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}><strong>{sub.userId?.name}</strong><div style={{ fontSize: 12, color: '#888' }}>{sub.userId?.email}</div></td>
                    <td style={styles.td}>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : '—'}</td>
                    <td style={styles.td}>{sub.manualScore !== null && sub.manualScore !== undefined ? <strong style={{ color: '#27ae60' }}>{sub.manualScore}</strong> : <span style={{ color: '#aaa' }}>—</span>}</td>
                    <td style={styles.td}>{sub.gradedAt ? <span style={styles.badge('#27ae60')}>✅ Graded</span> : sub.status === 'submitted' ? <span style={styles.badge('#e67e22')}>⏳ Pending</span> : <span style={styles.badge('#aaa')}>📝 In Progress</span>}</td>
                    <td style={styles.td}>{sub.status === 'submitted' && <button onClick={() => setSelected(sub)} style={styles.smallBtn}>{sub.gradedAt ? '✏️ Re-grade' : '📋 Grade'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function GradeForm({ submission, questions, onBack, onSaved }) {
  const [scores, setScores] = useState(() => {
    const s = {};
    (submission.questionScores || []).forEach(qs => { s[qs.questionIndex] = qs.score; });
    return s;
  });
  const [feedback, setFeedback] = useState(submission.trainerFeedback || '');
  const [manualScore, setManualScore] = useState(submission.manualScore ?? '');
  const [autoTotal, setAutoTotal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (autoTotal) {
      const t = Object.values(scores).reduce((a, b) => a + (Number(b) || 0), 0);
      setManualScore(t);
    }
  }, [scores, autoTotal]);

  const save = async () => {
    setSaving(true);
    try {
      const questionScores = questions.map((q, i) => ({ questionIndex: i, score: Number(scores[i]) || 0, maxScore: 10, feedback: '' }));
      const res = await axios.patch(`${API}/trainer/submissions/${submission._id}/grade`, { manualScore: Number(manualScore) || 0, trainerFeedback: feedback, questionScores }, headers());
      onSaved(res.data.submission);
    } catch (e) { alert('Error saving: ' + (e.response?.data?.message || e.message)); }
    setSaving(false);
  };

  const answers = {};
  (submission.answers || []).forEach(a => { answers[a.questionIndex] = a.answer; });

  return (
    <div style={styles.gradeForm}>
      <button onClick={onBack} style={styles.backBtn}>← Back to list</button>
      <h3 style={{ marginTop: 16 }}>📋 Grading: <span style={{ color: '#3498db' }}>{submission.userId?.name}</span></h3>
      {questions.map((q, i) => (
        <div key={i} style={styles.questionCard}>
          <div style={styles.qText}>Q{i + 1}: {q.questionText || q}</div>
          <div style={styles.answerBox}><strong>Answer:</strong><p style={styles.answerText}>{answers[i] || <em style={{ color: '#aaa' }}>No answer</em>}</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 13 }}>Score (out of 10):</label>
            <input type="number" min="0" max="10" value={scores[i] ?? ''} onChange={e => setScores(prev => ({ ...prev, [i]: e.target.value }))} style={styles.scoreInput} />
          </div>
        </div>
      ))}
      <div style={styles.gradeSummary}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={autoTotal} onChange={e => setAutoTotal(e.target.checked)} />
          Auto-total from question scores
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label>Total Score:</label>
          <input type="number" value={manualScore} disabled={autoTotal} onChange={e => setManualScore(e.target.value)} style={{ ...styles.scoreInput, width: 80 }} />
          <span style={{ color: '#888', fontSize: 13 }}>/ {questions.length * 10}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Overall Feedback:</label>
          <textarea value={feedback} rows={3} onChange={e => setFeedback(e.target.value)} placeholder="Write feedback for the student…" style={styles.feedbackArea} />
        </div>
        <button onClick={save} disabled={saving} style={{ ...styles.btn, background: '#27ae60', marginTop: 12 }}>{saving ? '💾 Saving…' : '💾 Save Grade'}</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STUDENTS TAB
// ════════════════════════════════════════════════════════════
function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get(`${API}/trainer/students`, headers())
      .then(r => setStudents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Loader />;

  return (
    <div>
      <h2 style={styles.pageTitle}>👥 Students</h2>
      {selected ? <StudentDetail student={selected} onBack={() => setSelected(null)} /> : (
        <>
          <input placeholder="🔍 Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={styles.searchInput} />
          <div style={styles.studentGrid}>
            {filtered.map(s => (
              <div key={s._id} style={styles.studentCard} onClick={() => setSelected(s)}>
                <div style={styles.avatarLg}>{s.name[0].toUpperCase()}</div>
                <div style={styles.studentName}>{s.name}</div>
                <div style={styles.studentEmail}>{s.email}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StudentDetail({ student, onBack }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/trainer/submissions/student/${student._id}`, headers())
      .then(r => setSubs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [student._id]);

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back to students</button>
      <div style={styles.studentDetailCard}>
        <div style={styles.avatarLg}>{student.name[0].toUpperCase()}</div>
        <h3 style={{ margin: '8px 0 4px' }}>{student.name}</h3>
        <div style={{ color: '#888', fontSize: 13 }}>{student.email}</div>
      </div>
      <h4 style={{ marginTop: 24 }}>📋 Assignment History</h4>
      {loading ? <Loader /> : subs.length === 0 ? <div style={styles.noData}>No submissions yet</div> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Assignment</th><th style={styles.th}>Date</th><th style={styles.th}>Status</th><th style={styles.th}>Score</th><th style={styles.th}>Feedback</th></tr></thead>
            <tbody>
              {subs.map((sub, i) => (
                <tr key={sub._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={styles.td}>{sub.assignmentId?.title || '—'}</td>
                  <td style={styles.td}>{sub.assignmentId?.date || '—'}</td>
                  <td style={styles.td}>{sub.status === 'submitted' ? <span style={styles.badge('#27ae60')}>✅ Submitted</span> : <span style={styles.badge('#e67e22')}>⏳ In Progress</span>}</td>
                  <td style={styles.td}>{sub.manualScore !== null && sub.manualScore !== undefined ? sub.manualScore : '—'}</td>
                  <td style={styles.td}>{sub.trainerFeedback || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  GROUP CHAT TAB — real-time with ChatMessage model
// ════════════════════════════════════════════════════════════
function GroupChatTab({ user }) {
  const [courses, setCourses]     = useState([]);
  const [courseId, setCourseId]   = useState('');
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping]       = useState(null);
  const [showVis, setShowVis]     = useState(false);

  const bottomRef = useRef(null);
  const typTimer  = useRef(null);
  const userId    = user._id || user.id;
  const userName  = user.name || 'Trainer';
  const userRole  = user.role || 'teacher';

  // Load available courses
  useEffect(() => {
    axios.get(`http://localhost:5000/api/courses`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => {
        setCourses(r.data || []);
        if (r.data?.length > 0) setCourseId(r.data[0]._id);
      })
      .catch(console.error);
  }, []);

  // Load message history when courseId changes
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    axios.get(`http://localhost:5000/api/chat/${courseId}?limit=100`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => setMessages(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  // Socket setup when courseId changes
  useEffect(() => {
    if (!courseId || !userId) return;

    if (!socketInstance || !socketInstance.connected) {
      socketInstance = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        auth: { token: token() },
      });
    }

    const s = socketInstance;
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessage    = (msg) => {
      if (canSee(msg, user)) {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
      }
    };
    const onDeleted    = ({ _id }) => setMessages(prev => prev.filter(m => m._id !== _id));
    const onTyping     = ({ userName: n }) => {
      if (n !== userName) {
        setTyping(n);
        clearTimeout(typTimer.current);
        typTimer.current = setTimeout(() => setTyping(null), 3000);
      }
    };
    const onStopTyping = () => setTyping(null);

    s.on('connect',              onConnect);
    s.on('disconnect',           onDisconnect);
    s.on('chat-message',         onMessage);
    s.on('chat-message-deleted', onDeleted);
    s.on('user-typing',          onTyping);
    s.on('user-stop-typing',     onStopTyping);

    s.emit('join-course-chat', { courseId, userId, userName, userRole });
    setConnected(s.connected);

    return () => {
      s.off('connect',              onConnect);
      s.off('disconnect',           onDisconnect);
      s.off('chat-message',         onMessage);
      s.off('chat-message-deleted', onDeleted);
      s.off('user-typing',          onTyping);
      s.off('user-stop-typing',     onStopTyping);
      s.emit('leave-course-chat', { courseId });
    };
  }, [courseId, userId]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const sendMessage = () => {
    const msg = input.trim();
    if (!msg || sending || !courseId) return;
    setSending(true);
    socketInstance?.emit('send-chat-message', {
      courseId, senderId: userId, senderName: userName,
      senderRole: userRole, message: msg, visibility,
    });
    socketInstance?.emit('stop-typing', { courseId });
    setInput('');
    setSending(false);
  };

  const deleteMessage = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    socketInstance?.emit('delete-chat-message', { courseId, msgId, userId, userRole });
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socketInstance?.emit('typing', { courseId, userName });
    clearTimeout(typTimer.current);
    typTimer.current = setTimeout(() => socketInstance?.emit('stop-typing', { courseId }), 1500);
  };

  const currentVis = VIS_OPTIONS.find(v => v.value === visibility);

  return (
    <div style={styles.chatWrapper}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={styles.pageTitle}>💬 Group Chat</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#888' }}>Course:</span>
          <select value={courseId} onChange={e => setCourseId(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: connected ? '#27ae60' : '#e74c3c' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#27ae60' : '#e74c3c', display: 'inline-block' }} />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        </div>
      </div>

      {/* Messages box */}
      <div style={styles.chatBox}>
        {loading ? <Loader /> : messages.length === 0 ? (
          <div style={styles.noData}>No messages yet in this course. Say hello! 👋</div>
        ) : (
          messages.map((msg, i) => {
            const isMe   = msg.senderId?.toString() === userId?.toString();
            const prev   = messages[i - 1];
            const showSender = !prev || prev.senderId?.toString() !== msg.senderId?.toString();
            const visBadge   = msg.visibility !== 'everyone' ? VIS_OPTIONS.find(v => v.value === msg.visibility) : null;
            const canDel = isMe || userRole === 'admin' || userRole === 'teacher' || userRole === 'trainer';

            return (
              <div key={msg._id || i} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: showSender ? 12 : 2 }}>
                {!isMe && showSender && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: msg.senderRole === 'admin' ? '#e74c3c' : msg.senderRole === 'teacher' ? '#8e44ad' : '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                {!isMe && !showSender && <div style={{ width: 32, flexShrink: 0 }} />}
                <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {showSender && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{isMe ? 'You' : msg.senderName}</span>
                      {msg.senderRole !== 'student' && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: msg.senderRole === 'admin' ? '#e74c3c22' : '#8e44ad22', color: msg.senderRole === 'admin' ? '#e74c3c' : '#8e44ad', fontWeight: 700 }}>
                          {msg.senderRole === 'admin' ? '👑 Admin' : '🎓 Trainer'}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ padding: '9px 13px', borderRadius: isMe ? '14px 3px 14px 14px' : '3px 14px 14px 14px', background: isMe ? '#8e44ad' : '#f0f0f0', color: isMe ? '#fff' : '#222', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', position: 'relative' }}>
                      {msg.message}
                      {canDel && (
                        <button onClick={() => deleteMessage(msg._id)}
                          title="Delete"
                          style={{ position: 'absolute', top: 2, right: isMe ? 4 : 'auto', left: isMe ? 'auto' : 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: isMe ? 'rgba(255,255,255,0.5)' : '#bbb', padding: 0, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#aaa', whiteSpace: 'nowrap', paddingBottom: 3 }}>{fmtTime(msg.createdAt)}</div>
                  </div>
                  {visBadge && (
                    <div style={{ fontSize: 10, color: visBadge.color, background: visBadge.color + '15', border: `1px solid ${visBadge.color}30`, borderRadius: 10, padding: '1px 7px' }}>
                      {visBadge.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 3, padding: '8px 12px', background: '#f0f0f0', borderRadius: '3px 14px 14px 14px' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
            </div>
            <span style={{ fontSize: 11, color: '#aaa' }}>{typing} is typing…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 12 }}>
        {/* Visibility selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
          <span style={{ fontSize: 12, color: '#888' }}>Send to:</span>
          <button onClick={() => setShowVis(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 16, border: `1px solid ${currentVis.color}55`, background: currentVis.color + '15', color: currentVis.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {currentVis.label} <span style={{ fontSize: 9 }}>▼</span>
          </button>
          {showVis && (
            <div style={{ position: 'absolute', bottom: '130%', left: 60, background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: 6, zIndex: 999, minWidth: 220, boxShadow: '0 6px 24px #0002' }}>
              {VIS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setVisibility(opt.value); setShowVis(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: visibility === opt.value ? opt.color + '20' : 'transparent', color: visibility === opt.value ? opt.color : '#333', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: visibility === opt.value ? 700 : 400, marginBottom: 2 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={styles.chatInput}>
          <input
            value={input}
            onChange={handleTyping}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Type a message… (Enter to send)"
            style={styles.chatTextInput}
            disabled={sending || !courseId}
          />
          <button onClick={sendMessage} disabled={sending || !input.trim() || !courseId} style={{ ...styles.sendBtn, opacity: !input.trim() ? 0.5 : 1 }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SESSION NOTES TAB
// ════════════════════════════════════════════════════════════
function SessionNotesTab() {
  const user = JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');
  const courseId = user.enrolledCourse || user.courseId || '';

  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [tags, setTags]         = useState('');
  const [shared, setShared]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [editId, setEditId]     = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/session-notes${courseId ? `?courseId=${courseId}` : ''}`, headers());
      setNotes(res.data || []);
    } catch { showToast('❌ Failed to load notes'); }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim() || !content.trim()) return showToast('⚠️ Title and content required');
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = { topic: title.trim(), content: content.trim(), tags: tags.split(',').map(t => t.trim()).filter(Boolean), sharedWithStudents: shared, courseId, date: today };
      if (editId) {
        const res = await axios.patch(`${API}/session-notes/${editId}`, payload, headers());
        setNotes(prev => prev.map(n => n._id === editId ? res.data : n));
        showToast('✅ Note updated!');
      } else {
        const res = await axios.post(`${API}/session-notes`, payload, headers());
        setNotes(prev => [res.data, ...prev]);
        showToast('✅ Note saved!');
      }
      setTitle(''); setContent(''); setTags(''); setShared(false); setEditId(null);
    } catch (e) { showToast('❌ ' + (e.response?.data?.message || 'Save failed')); }
    setSaving(false);
  };

  const toggleShare = async (note) => {
    try {
      const res = await axios.patch(`${API}/session-notes/${note._id}`, { sharedWithStudents: !note.sharedWithStudents }, headers());
      setNotes(prev => prev.map(n => n._id === note._id ? res.data : n));
    } catch { showToast('❌ Failed to update'); }
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await axios.delete(`${API}/session-notes/${id}`, headers());
      setNotes(prev => prev.filter(n => n._id !== id));
      showToast('🗑️ Note deleted');
    } catch { showToast('❌ Delete failed'); }
  };

  const startEdit = (note) => {
    setEditId(note._id); setTitle(note.topic || note.title || ''); setContent(note.content);
    setTags((note.tags || []).join(', ')); setShared(note.sharedWithStudents || false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>📓 Session Notes</h2>
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Add/Edit Form */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: '#1a1a2e', fontSize: 16 }}>{editId ? '✏️ Edit Note' : '➕ New Session Note'}</h3>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Session title (e.g. React Hooks – Day 5)" style={{ ...styles.searchInput, marginBottom: 10 }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Session content, summary, key points…" rows={5}
          style={{ width: '100%', borderRadius: 6, border: '1px solid #ddd', padding: 10, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma separated): React, Hooks, useState" style={{ ...styles.searchInput, marginBottom: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            <span>👁️ Share with students</span>
          </label>
          <button onClick={save} disabled={saving} style={{ ...styles.btn, background: '#8e44ad' }}>{saving ? '💾 Saving…' : editId ? '💾 Update Note' : '💾 Save Note'}</button>
          {editId && <button onClick={() => { setEditId(null); setTitle(''); setContent(''); setTags(''); setShared(false); }} style={{ ...styles.btn, background: '#aaa' }}>✕ Cancel</button>}
        </div>
      </div>

      {/* Notes List */}
      {loading ? <Loader /> : notes.length === 0 ? <div style={styles.noData}>📭 No session notes yet</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {notes.map(note => (
            <div key={note._id} style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid', borderLeftColor: note.sharedWithStudents ? '#27ae60' : '#8e44ad' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 16, color: '#1a1a2e' }}>{note.topic || note.title}</strong>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{note.date || new Date(note.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => toggleShare(note)} style={{ ...styles.smallBtn, background: note.sharedWithStudents ? '#27ae60' : '#aaa' }}>
                    {note.sharedWithStudents ? '👁️ Shared' : '🔒 Private'}
                  </button>
                  <button onClick={() => startEdit(note)} style={{ ...styles.smallBtn, background: '#e67e22' }}>✏️ Edit</button>
                  <button onClick={() => deleteNote(note._id)} style={{ ...styles.smallBtn, background: '#e74c3c' }}>🗑️</button>
                </div>
              </div>
              <p style={{ margin: '10px 0 8px', color: '#444', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
              {(note.tags || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {note.tags.map((tag, i) => <span key={i} style={{ background: '#8e44ad15', color: '#8e44ad', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{tag}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  DOUBT TRACKER TAB
// ════════════════════════════════════════════════════════════
function DoubtTrackerTab() {
  const user = JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');
  const courseId = user.enrolledCourse || user.courseId || '';

  const [doubts, setDoubts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');   // all | pending | resolved
  const [resolveId, setResolveId] = useState(null);
  const [answer, setAnswer]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = courseId ? `?courseId=${courseId}` : '';
      const res = await axios.get(`${API}/doubts${params}`, headers());
      setDoubts(res.data || []);
    } catch { showToast('❌ Failed to load doubts'); }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id) => {
    if (!answer.trim()) return showToast('⚠️ Please write an answer');
    setSaving(true);
    try {
      const res = await axios.patch(`${API}/doubts/${id}/resolve`, { answer: answer.trim() }, headers());
      setDoubts(prev => prev.map(d => d._id === id ? res.data : d));
      setResolveId(null); setAnswer('');
      showToast('✅ Doubt resolved!');
    } catch { showToast('❌ Failed to resolve'); }
    setSaving(false);
  };

  const priColor = { high: '#e74c3c', medium: '#e67e22', low: '#27ae60' };

  const isResolved = (d) => d.status === 'resolved' || d.resolved === true;

  const filtered = doubts.filter(d =>
    filter === 'all' ? true : filter === 'resolved' ? isResolved(d) : !isResolved(d)
  );

  const pending  = doubts.filter(d => !isResolved(d)).length;
  const resolved = doubts.filter(d => isResolved(d)).length;

  return (
    <div>
      <h2 style={styles.pageTitle}>❓ Doubt Tracker</h2>
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all', `📋 All (${doubts.length})`, '#3498db'], ['pending', `⏳ Pending (${pending})`, '#e67e22'], ['resolved', `✅ Resolved (${resolved})`, '#27ae60']].map(([val, label, color]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: 20, border: `2px solid ${filter === val ? color : '#eee'}`, background: filter === val ? color : '#fff', color: filter === val ? '#fff' : '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? <div style={styles.noData}>📭 No doubts found</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(d => (
            <div key={d._id} style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid', borderLeftColor: isResolved(d) ? '#27ae60' : (priColor[d.priority] || '#e67e22') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 15 }}>👤 {d.studentId?.name || d.studentName || 'Student'}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{d.studentId?.email}</span>
                  <span style={{ background: (priColor[d.priority] || '#e67e22') + '20', color: priColor[d.priority] || '#e67e22', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{d.priority?.toUpperCase() || 'MEDIUM'}</span>
                </div>
                <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <p style={{ margin: '0 0 10px', color: '#333', fontWeight: 600 }}>❓ {d.question}</p>
              {isResolved(d) ? (
                <div style={{ background: '#27ae6010', borderRadius: 8, padding: 12, borderLeft: '3px solid #27ae60' }}>
                  <strong style={{ color: '#27ae60', fontSize: 13 }}>✅ Resolved:</strong>
                  <p style={{ margin: '4px 0 0', color: '#444', fontSize: 14 }}>{d.answer}</p>
                </div>
              ) : resolveId === d._id ? (
                <div style={{ marginTop: 10 }}>
                  <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer / resolution…" rows={3}
                    style={{ width: '100%', borderRadius: 6, border: '1px solid #ddd', padding: 10, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => resolve(d._id)} disabled={saving} style={{ ...styles.btn, background: '#27ae60' }}>{saving ? 'Saving…' : '✅ Submit Answer'}</button>
                    <button onClick={() => { setResolveId(null); setAnswer(''); }} style={{ ...styles.btn, background: '#aaa' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setResolveId(d._id); setAnswer(''); }} style={{ ...styles.smallBtn, background: '#8e44ad' }}>💬 Resolve Doubt</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  RESOURCES TAB
// ════════════════════════════════════════════════════════════
function ResourcesTab() {
  const user = JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');
  const courseId = user.enrolledCourse || user.courseId || '';

  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [title, setTitle]         = useState('');
  const [url, setUrl]             = useState('');
  const [type, setType]           = useState('link');
  const [desc, setDesc]           = useState('');
  const [shared, setShared]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = courseId ? `?courseId=${courseId}` : '';
      const res = await axios.get(`${API}/resources${params}`, headers());
      setResources(res.data || []);
    } catch { showToast('❌ Failed to load resources'); }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const addResource = async () => {
    if (!title.trim() || !url.trim()) return showToast('⚠️ Title and URL required');
    setSaving(true);
    try {
      const res = await axios.post(`${API}/resources`, { title: title.trim(), url: url.trim(), type, desc: desc.trim(), sharedWithStudents: shared, courseId }, headers());
      setResources(prev => [res.data, ...prev]);
      setTitle(''); setUrl(''); setDesc(''); setShared(false); setType('link');
      showToast('✅ Resource added!');
    } catch (e) { showToast('❌ ' + (e.response?.data?.message || 'Failed')); }
    setSaving(false);
  };

  const toggleShare = async (r) => {
    try {
      const res = await axios.patch(`${API}/resources/${r._id}`, { sharedWithStudents: !r.sharedWithStudents }, headers());
      setResources(prev => prev.map(x => x._id === r._id ? res.data : x));
    } catch { showToast('❌ Failed'); }
  };

  const deleteRes = async (id) => {
    if (!window.confirm('Delete resource?')) return;
    try {
      await axios.delete(`${API}/resources/${id}`, headers());
      setResources(prev => prev.filter(r => r._id !== id));
      showToast('🗑️ Deleted');
    } catch { showToast('❌ Failed'); }
  };

  const typeIcon = { link: '🔗', video: '🎥', pdf: '📄', doc: '📝', github: '🐙' };

  return (
    <div>
      <h2 style={styles.pageTitle}>📎 Resources</h2>
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Add Resource Form */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: '#1a1a2e', fontSize: 16 }}>➕ Add Resource</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (e.g. React Docs)" style={{ ...styles.dateInput, width: '100%', boxSizing: 'border-box' }} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL / Link" style={{ ...styles.dateInput, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...styles.dateInput, width: '100%', boxSizing: 'border-box' }}>
            {Object.entries(typeIcon).map(([k, v]) => <option key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
          </select>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description (optional)" style={{ ...styles.dateInput, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            <span>👁️ Share with students</span>
          </label>
          <button onClick={addResource} disabled={saving} style={{ ...styles.btn, background: '#3498db' }}>{saving ? '💾 Saving…' : '➕ Add Resource'}</button>
        </div>
      </div>

      {/* Resources List */}
      {loading ? <Loader /> : resources.length === 0 ? <div style={styles.noData}>📭 No resources yet</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {resources.map(r => (
            <div key={r._id} style={{ background: '#fff', borderRadius: 10, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${r.sharedWithStudents ? '#27ae60' : '#8e44ad'}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>{typeIcon[r.type] || '📎'}</span>
                <span style={{ fontSize: 11, color: r.sharedWithStudents ? '#27ae60' : '#aaa', fontWeight: 700 }}>{r.sharedWithStudents ? '👁️ Shared' : '🔒 Private'}</span>
              </div>
              <strong style={{ color: '#1a1a2e', fontSize: 15, lineHeight: 1.3 }}>{r.title}</strong>
              {(r.desc || r.description) && <p style={{ margin: 0, color: '#666', fontSize: 13, lineHeight: 1.5 }}>{r.desc || r.description}</p>}
              <a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#3498db', fontSize: 13, wordBreak: 'break-all' }}>{r.url}</a>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <button onClick={() => toggleShare(r)} style={{ ...styles.smallBtn, background: r.sharedWithStudents ? '#27ae60' : '#8e44ad', flex: 1 }}>
                  {r.sharedWithStudents ? '🔒 Make Private' : '👁️ Share'}
                </button>
                <button onClick={() => deleteRes(r._id)} style={{ ...styles.smallBtn, background: '#e74c3c' }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
function Loader() {
  return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Loading…</div>;
}

const styles = {
  // kept for tabs that still use styles.*
  pageTitle:       { fontSize: 20, fontWeight: 700, color: '#1e1b4b', marginBottom: 20, marginTop: 0 },
  cardGrid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 },
  statCard:        { background: '#fff', borderRadius: 14, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  toolbar:         { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  dateInput:       { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, colorScheme: 'light', color: '#333', background: '#fff' },
  btn:             { padding: '9px 18px', borderRadius: 8, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  smallBtn:        { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  summaryBadge:    { background: '#f1f5f9', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: '#475569', fontWeight: 600 },
  tableWrap:       { overflowX: 'auto', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  table:           { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12 },
  th:              { padding: '13px 16px', background: '#f8fafc', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  td:              { padding: '13px 16px', fontSize: 14, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', color: '#334155' },
  statusBtns:      { display: 'flex', gap: 6 },
  statusBtn:       { padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  badge:           (color) => ({ background: color, color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }),
  noData:          { textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 15 },
  toast:           { position: 'fixed', top: 24, right: 24, background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: 12, zIndex: 9999, fontWeight: 700, boxShadow: '0 4px 20px rgba(16,185,129,0.4)' },
  searchInput:     { width: '100%', maxWidth: 400, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, marginBottom: 20, boxSizing: 'border-box', outline: 'none' },
  studentGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  studentCard:     { background: '#fff', borderRadius: 14, padding: 20, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1.5px solid #f1f5f9', transition: 'all 0.2s' },
  avatarLg:        { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  studentName:     { fontWeight: 700, fontSize: 15, color: '#1e1b4b' },
  studentEmail:    { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  studentDetailCard:{ background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'inline-block' },
  backBtn:         { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 },
  gradeForm:       { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  questionCard:    { border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 16, background: '#fafafa' },
  qText:           { fontWeight: 700, color: '#1e1b4b', marginBottom: 10, fontSize: 15 },
  answerBox:       { background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' },
  answerText:      { margin: '6px 0 0', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  scoreInput:      { width: 64, padding: '6px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 14, textAlign: 'center' },
  gradeSummary:    { background: '#f8fafc', borderRadius: 12, padding: 22, marginTop: 10, border: '1px solid #e2e8f0' },
  feedbackArea:    { width: '100%', borderRadius: 8, border: '1.5px solid #e2e8f0', padding: 12, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', background: '#fff' },
  chatWrapper:     { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' },
  chatBox:         { flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid #f1f5f9' },
  chatInput:       { display: 'flex', gap: 8 },
  chatTextInput:   { flex: 1, padding: '12px 18px', borderRadius: 24, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff' },
  sendBtn:         { width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' },
};

// ── New Design System ────────────────────────────────────────
const S = {
  wrapper:       { display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans','Segoe UI',sans-serif", background: '#f8fafc' },

  // Sidebar
  sidebar:       { width: 240, background: 'linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden', flexShrink: 0, zIndex: 100,
    scrollbarWidth: 'none', msOverflowStyle: 'none' },
  sidebarLogo:   { display: 'flex', alignItems: 'center', gap: 10, padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  logoIcon:      { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  logoText:      { color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: 0.5 },
  logoSub:       { color: '#6366f1', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 1 },

  profileCard:   { margin: '16px 12px', background: 'rgba(99,102,241,0.12)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(99,102,241,0.2)' },
  profileAvatar: { width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' },
  profileName:   { color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 6 },
  profileBadge:  { display: 'inline-block', background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.3)' },

  navBtn:        { width: '100%', padding: '11px 16px', paddingLeft: '13px', background: 'none', border: 'none', borderLeft: '3px solid transparent', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, position: 'relative', transition: 'all 0.15s' },
  navBtnActive:  { background: 'rgba(99,102,241,0.15)', color: '#e0e7ff', borderLeft: '3px solid #6366f1', fontWeight: 700 },
  navIcon:       { fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 },
  navDot:        { marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 'auto' },

  // Main
  main:          { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden', marginLeft: 240 },
  topBar:        { background: '#fff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'sticky', top: 0, zIndex: 10 },
  topBarGreeting:{ fontSize: 16, fontWeight: 700, color: '#1e1b4b' },
  topBarSub:     { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  topBarRight:   { display: 'flex', alignItems: 'center', gap: 14 },
  topBarDate:    { fontSize: 13, color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '6px 14px', borderRadius: 20, border: '1px solid #e2e8f0' },
  topBarAvatar:  { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  content:       { flex: 1, padding: '28px 32px', overflowY: 'auto' },
};