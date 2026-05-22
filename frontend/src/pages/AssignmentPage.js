import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { API_BASE as API } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CodeEditor from '../components/CodeEditor';
import Sidebar from '../components/Sidebar';

export default function AssignmentPage() {
  const { date } = useParams();
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [questions, setQuestions]         = useState({ A: [], B: [], C: [] });
  const [submission, setSubmission]       = useState(null);
  const [answers, setAnswers]             = useState({});
  const [activeSection, setActiveSection] = useState('A');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [savingQ, setSavingQ]             = useState({}); // per-question saving state
  const [submitted, setSubmitted]         = useState(false);
  const [isEditing, setIsEditing]         = useState(false); // editing after submit
  const [openEditors, setOpenEditors]     = useState({});
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  // deadlineDate: Date object — set from backend; null = not yet loaded
  const [deadlineDate, setDeadlineDate]   = useState(null);

  const toggleEditor = (qId) => setOpenEditors(prev => ({ ...prev, [qId]: !prev[qId] }));

  // ── Timer ──────────────────────────────────────────────────
  const [timeLeft, setTimeLeft]       = useState('');
  const [timerUrgent, setTimerUrgent] = useState(false);
  const [msLeft, setMsLeft]           = useState(null);

  // ── Warning toasts ─────────────────────────────────────────
  const [warnings, setWarnings] = useState([]);
  const firedWarnings           = useRef(new Set());
  const questionsRef            = useRef(null);

  const isToday = date === new Date().toISOString().split('T')[0];

  // Timer tick — uses admin-set deadline (falls back to midnight if none)
  useEffect(() => {
    // deadlineDate null means not loaded yet; wait
    if (!deadlineDate) return;

    const tick = () => {
      const now  = new Date();
      const diff = deadlineDate - now;
      setMsLeft(diff);
      if (diff <= 0) {
        setTimeLeft('Time Up!');
        setDeadlinePassed(true);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      setTimerUrgent(diff < 30 * 60_000);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlineDate]);

  // For past dates, or if deadline already passed — read-only
  useEffect(() => {
    if (!isToday) {
      setDeadlinePassed(true);
    } else if (deadlineDate && deadlineDate <= new Date()) {
      setDeadlinePassed(true);
    }
  }, [isToday, deadlineDate]);

  const isPastDate = date < new Date().toISOString().split('T')[0];

  // Warning milestones
  useEffect(() => {
    if (!isToday || submitted || msLeft === null) return;
    const milestones = [
      { ms: 60 * 60_000, key: '60min', level: 'info',    msg: '⏰ 1 hour left! Start wrapping up your assignment.' },
      { ms: 30 * 60_000, key: '30min', level: 'warning', msg: '⚠️ 30 minutes left! Submit soon to avoid auto-submit.' },
      { ms: 10 * 60_000, key: '10min', level: 'danger',  msg: `🚨 10 minutes left! Assignment will AUTO-SUBMIT at ${deadlineDate ? deadlineDate.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : 'deadline'}!` },
      { ms:  5 * 60_000, key: '5min',  level: 'danger',  msg: '🔴 Only 5 minutes! AUTO-SUBMIT is very close!' },
    ];
    milestones.forEach(({ ms, key, level, msg }) => {
      if (msLeft <= ms && !firedWarnings.current.has(key)) {
        firedWarnings.current.add(key);
        const id = `${Date.now()}-${key}`;
        setWarnings(prev => [...prev, { id, level, msg }]);
        setTimeout(() => setWarnings(prev => prev.filter(w => w.id !== id)), 12_000);
      }
    });
    if (msLeft <= 0 && !firedWarnings.current.has('autosubmit')) {
      firedWarnings.current.add('autosubmit');
      doAutoSubmit();
    }
  }, [msLeft, submitted, isToday]);

  const doAutoSubmit = useCallback(async () => {
    if (submitted) return;
    try {
      await api.patch('/api/submissions/submit',
        { traineeId: user._id, date }, { headers });
      setSubmitted(true);
      setIsEditing(false);
      const id = 'autosubmit-done';
      setWarnings([{ id, level: 'info', msg: `✅ Assignment auto-submitted at ${deadlineDate ? deadlineDate.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : 'deadline'}!` }]);
    } catch (err) { console.error('Auto-submit error:', err); }
  }, [submitted]);

  const handleSectionChange = (sec) => {
    setActiveSection(sec);
    setTimeout(() => {
      if (questionsRef.current) questionsRef.current.scrollTop = 0;
    }, 50);
  };

  const dismissWarning = (id) => setWarnings(prev => prev.filter(w => w.id !== id));

  // Listen for admin reopen via socket or storage event
  useEffect(() => {
    const handleReopen = () => { loadData(); };
    window.addEventListener('submission-reopened', handleReopen);
    return () => window.removeEventListener('submission-reopened', handleReopen);
  }, []);

  // Listen for score-published socket event from admin
  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!userId || !token) return;
    // Import io dynamically to avoid issues
    let s;
    try {
      const { io } = require('socket.io-client');
      s = io(require('../api').API_BASE, {
        transports: ['websocket'],
        reconnection: true,
        auth: { token },
      });
      s.on('connect', () => s.emit('join-user', userId));
      s.on('score-published', (data) => {
        if (data.date === date) {
          setSubmission(prev => prev ? {
            ...prev,
            scorePublished: true,
            manualScore: data.manualScore,
            trainerFeedback: data.trainerFeedback,
            adminFeedback: data.adminFeedback,
          } : prev);
        }
      });
    } catch(e) { /* socket.io not available */ }
    return () => { if (s) s.disconnect(); };
  }, [date, token]);

  // Load data
  const courseId = user?.enrolledCourse;
  useEffect(() => { if (courseId) loadData(); }, [date]);

  const loadData = async () => {
    try {
      setLoading(true);
      const qRes = await api.get(`/api/questions/${courseId}/${date}`, { headers });
      // Backend returns { questions, deadline } — deadline is ISO string or null
      const { questions: allQs, deadline: deadlineISO } = qRes.data;

      // Compute effective deadline: admin-set value OR midnight of the assignment date
      let effectiveDeadline;
      if (deadlineISO) {
        effectiveDeadline = new Date(deadlineISO);
      } else {
        // fallback: midnight at the end of the assignment date
        const d = new Date(date); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
        effectiveDeadline = d;
      }
      setDeadlineDate(effectiveDeadline);

      const grouped = {
        A: allQs.filter(q => q.section === 'A'),
        B: allQs.filter(q => q.section === 'B'),
        C: allQs.filter(q => q.section === 'C'),
      };
      setQuestions(grouped);
      const initRes = await api.post('/api/submissions/init',
        { traineeId: user._id, courseId, date, secAQuestions: grouped.A, secBQuestions: grouped.B, secCQuestions: grouped.C },
        { headers });
      setSubmission(initRes.data);
      const isSubmitted = initRes.data.status === 'submitted';
      setSubmitted(isSubmitted);
      if (isSubmitted) setIsEditing(false);

      // Build answers map: try questionId match first, fallback to position
      const ea = {};
      ['A','B','C'].forEach(sec => {
        const subAnswers = initRes.data[`sec${sec}`]?.answers || [];
        const qs = grouped[sec];
        const byQId = {};
        subAnswers.forEach(a => { byQId[a.questionId?.toString()] = a.answerText || ''; });
        qs.forEach((q, i) => {
          const qid = q._id.toString();
          if (byQId[qid] !== undefined) {
            ea[qid] = byQId[qid];
          } else if (subAnswers[i]) {
            ea[qid] = subAnswers[i].answerText || '';
          } else {
            ea[qid] = '';
          }
        });
      });
      setAnswers(ea);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Debounce ref: avoid flooding API on every keystroke ──
  const saveTimer = useRef({});

  const handleAnswer = (questionId, text, section, marks) => {
    const qid = questionId.toString();
    setAnswers(prev => ({ ...prev, [qid]: text }));

    // Debounce auto-save in background
    if (saveTimer.current[qid]) clearTimeout(saveTimer.current[qid]);
    saveTimer.current[qid] = setTimeout(async () => {
      try {
        const res = await api.patch('/api/submissions/answer',
          { traineeId: user._id, date, section, questionId: qid, answerText: text, marks }, { headers });
        setSubmission(res.data);
      } catch (err) { console.error('Auto-save answer error:', err); }
    }, 800);
  };

  // Per-question explicit Save button
  const handleSaveQuestion = async (questionId, section, marks) => {
    const qid = questionId.toString();
    const text = answers[qid] || '';
    setSavingQ(prev => ({ ...prev, [qid]: true }));
    // Cancel any pending debounce
    if (saveTimer.current[qid]) { clearTimeout(saveTimer.current[qid]); delete saveTimer.current[qid]; }
    try {
      const res = await api.patch('/api/submissions/answer',
        { traineeId: user._id, date, section, questionId: qid, answerText: text, marks }, { headers });
      setSubmission(res.data);
    } catch (err) { console.error('Save question error:', err); }
    finally {
      setSavingQ(prev => ({ ...prev, [qid]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm(`Submit your assignment? You can still edit until ${deadlineDate ? deadlineDate.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : 'deadline'}.`)) return;
    try {
      setSaving(true);
      // Cancel all pending debounce timers
      Object.keys(saveTimer.current).forEach(qid => {
        clearTimeout(saveTimer.current[qid]);
        delete saveTimer.current[qid];
      });
      // Save ALL answered questions before submitting
      for (const sec of ['A','B','C']) {
        for (const q of (questions[sec] || [])) {
          const qid = q._id.toString();
          const text = answers[qid] || '';
          if (text.trim().length > 0) {
            try {
              await api.patch('/api/submissions/answer',
                { traineeId: user._id, date, section: sec, questionId: qid, answerText: text, marks: q.marks },
                { headers });
            } catch (e) { console.error('Save before submit:', e); }
          }
        }
      }
      // Now submit
      await api.patch('/api/submissions/submit', { traineeId: user._id, date }, { headers });
      setSubmitted(true);
      setIsEditing(false);
      window.dispatchEvent(new Event('assignment-submitted'));
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleEditAnswers = () => {
    if (deadlinePassed) {
      alert('Deadline has passed. Answers are view-only.');
      return;
    }
    setIsEditing(true);
  };

  // Whether textareas are disabled:
  // - disabled if deadline passed
  // - disabled if submitted and NOT in editing mode
  // Past date: always read-only. Today: read-only if submitted and not editing.
  const isReadOnly = deadlinePassed || (submitted && !isEditing);

  const secInfo = {
    A: { label:'Section A', level:'Easy',   total:20, min:10, marks:1, color:'#1D9E75', bg: isDark?'#1D9E7515':'#E1F5EE' },
    B: { label:'Section B', level:'Medium', total:20, min:10, marks:3, color:'#185FA5', bg: isDark?'#185FA515':'#E6F1FB' },
    C: { label:'Section C', level:'Hard',   total:10, min:5,  marks:5, color:'#534AB7', bg: isDark?'#534AB715':'#EEEDFE' },
  };
  const getScore    = (sec) => submission?.[`sec${sec}`]?.score    || 0;
  const getAnswered = (sec) => submission?.[`sec${sec}`]?.answered || 0;
  const totalScore  = getScore('A') + getScore('B') + getScore('C');
  const maxScore    = { A:20, B:60, C:50 };

  const warnStyle = {
    info:    { bg:'#185FA520', border:'#185FA5', color:'#4fa3f7' },
    warning: { bg:'#f5a62320', border:'#f5a623', color:'#f5c842' },
    danger:  { bg:'#ff000020', border:'#ff5555', color:'#ff7777' },
  };

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background: theme.pageBg }}>
      <div style={{ width:32, height:32, border:`3px solid ${theme.border}`, borderTop:`3px solid ${theme.accent}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color: theme.textMuted, marginTop:12 }}>Loading assignment...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <Sidebar activePath="/assignments" />
      <div style={{ marginLeft: window.innerWidth < 768 ? 0 : 240, display:'flex', flexDirection:'column', minHeight:'100vh', background: theme.pageBg, overflowX:'hidden', fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {/* Toast Stack */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8, maxWidth:360 }}>
        {warnings.map(w => (
          <div key={w.id} style={{ background: warnStyle[w.level].bg, border:`1.5px solid ${warnStyle[w.level].border}`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:10, boxShadow:`0 4px 24px ${warnStyle[w.level].border}33`, animation:'slideIn 0.3s ease' }}>
            <div style={{ flex:1, fontSize:13, color: warnStyle[w.level].color, fontWeight:600, lineHeight:1.4 }}>{w.msg}</div>
            <button onClick={() => dismissWarning(w.id)} style={{ background:'none', border:'none', color: warnStyle[w.level].color, cursor:'pointer', fontSize:16, padding:0, lineHeight:1, flexShrink:0 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding: window.innerWidth < 768 ? '56px 12px 12px' : '16px 24px', background: isDark?'#1a2740':'#1e3a5f', flexShrink:0, flexWrap:'wrap' }}>
        <button style={{ background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.2)', color:'#fff', padding:'7px 14px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600 }} onClick={() => navigate('/attendance')}>← Back</button>
        <div>
          <h2 style={{ color:'#fff', fontSize:18, fontWeight:700, margin:0 }}>Assignment — {date}</h2>
          <p style={{ color:'#a0b4c8', fontSize:12, margin:'2px 0 0 0' }}>MERN Stack Developer Course</p>
        </div>

        {isToday && !submitted && (
          <div style={{ marginLeft:'auto', borderRadius:12, padding:'8px 16px', textAlign:'center', transition:'all 0.3s', flexShrink:0, background: timerUrgent?'#ff000015':'rgba(255,255,255,0.1)', border:`1.5px solid ${timerUrgent?'#ff5555':'rgba(255,255,255,0.2)'}`, animation: timerUrgent?'pulse 1s ease-in-out infinite':'none' }}>
            <div style={{ fontSize:10, color: timerUrgent?'#ff9999':'#a0b4c8', fontWeight:600, letterSpacing:1, marginBottom:2 }}>⏰ TIME LEFT</div>
            <div style={{ fontSize:22, fontWeight:800, color: timerUrgent?'#ff5555':'#ffffff', fontVariantNumeric:'tabular-nums', letterSpacing:2 }}>{timeLeft}</div>
            <div style={{ fontSize:9, color: timerUrgent?'#ff9999':'#a0b4c8', marginTop:2 }}>{`Auto-submits at ${deadlineDate ? deadlineDate.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'deadline'}`}</div>
          </div>
        )}

        {isToday && submitted && !deadlinePassed && (
          <div style={{ marginLeft:'auto', borderRadius:12, padding:'8px 16px', textAlign:'center', flexShrink:0, background: timerUrgent?'#ff000015':'rgba(255,255,255,0.1)', border:`1.5px solid ${timerUrgent?'#ff5555':'rgba(255,255,255,0.2)'}` }}>
            <div style={{ fontSize:10, color:'#a0b4c8', fontWeight:600, letterSpacing:1, marginBottom:2 }}>⏰ TIME LEFT TO EDIT</div>
            <div style={{ fontSize:20, fontWeight:800, color: timerUrgent?'#ff5555':'#ffffff', fontVariantNumeric:'tabular-nums' }}>{timeLeft}</div>
          </div>
        )}

        {submitted && (
          <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft: isToday?0:'auto' }}>
            <div style={{ background:'#1D9E7522', border:'1.5px solid #1D9E75', color:'#1D9E75', borderRadius:12, padding:'10px 20px', fontWeight:700, fontSize:14, flexShrink:0 }}>✅ Submitted</div>
            {!deadlinePassed && !isEditing && (
              <button
                onClick={handleEditAnswers}
                style={{ background:'#185FA522', border:'1.5px solid #185FA5', color:'#185FA5', borderRadius:12, padding:'10px 20px', fontWeight:700, fontSize:14, cursor:'pointer', flexShrink:0 }}>
                ✏️ Edit Answers
              </button>
            )}
            {isEditing && (
              <div style={{ background:'#f5a62322', border:'1.5px solid #f5a623', color:'#f5a623', borderRadius:12, padding:'10px 16px', fontWeight:700, fontSize:13, flexShrink:0 }}>
                ✏️ Editing Mode
              </div>
            )}
            {deadlinePassed && (
              <div style={{ background:'#55555522', border:'1.5px solid #888', color:'#aaa', borderRadius:12, padding:'10px 16px', fontWeight:600, fontSize:13, flexShrink:0 }}>
                🔒 Deadline Passed
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign:'right', flexShrink:0 }}>
          {submission?.scorePublished ? (
            <>
              <span style={{ fontSize:28, fontWeight:700, color:'#fff' }}>{submission.manualScore ?? totalScore}</span>
              <span style={{ fontSize:16, color:'#a0b4c8' }}>/130</span>
            </>
          ) : submitted ? (
            <span style={{ fontSize:13, color:'#a0b4c8', fontStyle:'italic' }}>⏳ Awaiting grade</span>
          ) : null}
        </div>
        <button onClick={toggleTheme} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:12, fontWeight:600, padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Score + Feedback panel — shown only after admin publishes */}
      {submission?.scorePublished && (
        <div style={{ background:'#1D9E7515', borderBottom:'1px solid #1D9E7533', padding:'12px 24px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            <div>
              <span style={{ color:'#1D9E75', fontWeight:700, fontSize:13 }}>✅ Score Released</span>
              <span style={{ color:'#fff', fontWeight:800, fontSize:22, marginLeft:10 }}>{submission.manualScore ?? 0}</span>
              <span style={{ color:'#a0b4c8', fontSize:13 }}>/130</span>
            </div>
            {submission.trainerFeedback && (
              <div style={{ color:'#cdd', fontSize:13 }}>
                <span style={{ color:'#a0b4c8' }}>Trainer: </span>{submission.trainerFeedback}
              </div>
            )}
            {submission.adminFeedback && (
              <div style={{ color:'#cdd', fontSize:13 }}>
                <span style={{ color:'#a0b4c8' }}>Admin: </span>{submission.adminFeedback}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit mode notice bar */}
      {isEditing && (
        <div style={{ background:'#f5a62315', borderBottom:'1px solid #f5a62333', color:'#f5a623', textAlign:'center', padding:'8px 24px', fontSize:13, fontWeight:600, flexShrink:0 }}>
          ✏️ Editing mode — Save each answer individually, then re-submit when done.
        </div>
      )}

      {/* Deadline passed view-only notice */}
      {deadlinePassed && submitted && (
        <div style={{ background:'#55555515', borderBottom:'1px solid #88888833', color:'#888', textAlign:'center', padding:'8px 24px', fontSize:13, fontWeight:600, flexShrink:0 }}>
          🔒 Deadline passed — Viewing submitted answers (read-only)
        </div>
      )}

      {isToday && !submitted && timerUrgent && (
        <div style={{ background:'#ff000015', borderBottom:'1px solid #ff555533', color:'#ff5555', textAlign:'center', padding:'8px 24px', fontSize:13, fontWeight:600, flexShrink:0 }}>
          {`⚠️ Less than 30 minutes left! Assignment will AUTO-SUBMIT at ${deadlineDate ? deadlineDate.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : 'deadline'}.`}
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display:'flex', gap:8, padding:'12px 24px', background: theme.cardBg, borderBottom:`1px solid ${theme.border}`, flexShrink:0 }}>
        {['A','B','C'].map(sec => (
          <button key={sec}
            style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderRadius:10, border:'none', cursor:'pointer', fontSize:14, fontWeight:600, transition:'all 0.2s', background: activeSection===sec ? secInfo[sec].color : theme.hoverBg, color: activeSection===sec ? '#fff' : theme.textMuted }}
            onClick={() => handleSectionChange(sec)}>
            <span>{secInfo[sec].label}</span>
            <span style={{ fontSize:12, background:'rgba(255,255,255,0.25)', padding:'2px 8px', borderRadius:20 }}>{getAnswered(sec)}/{secInfo[sec].total}</span>
          </button>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 24px', flexShrink:0, background: secInfo[activeSection].bg }}>
        <div>
          <span style={{ color:'#fff', fontSize:12, padding:'3px 10px', borderRadius:20, fontWeight:600, marginRight:10, background: secInfo[activeSection].color }}>{secInfo[activeSection].level}</span>
          <span style={{ fontSize:13, color: isDark?theme.textSecondary:'#555' }}>Answer minimum {secInfo[activeSection].min} questions</span>
        </div>
        <div style={{ display:'flex', alignItems:'center' }}>
          <span style={{ color: secInfo[activeSection].color, fontWeight:700 }}>{getScore(activeSection)}/{maxScore[activeSection]}</span>
          <span style={{ fontSize:12, color: theme.textMuted, marginLeft:6 }}>marks</span>
        </div>
      </div>

      <div style={{ height:4, background: theme.border, flexShrink:0 }}>
        <div style={{ height:4, transition:'width 0.4s ease', borderRadius:'0 4px 4px 0', width:`${(getAnswered(activeSection)/secInfo[activeSection].total)*100}%`, background: secInfo[activeSection].color }} />
      </div>

      {/* Questions */}
      <div ref={questionsRef} style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:12 }}>
        {questions[activeSection].length === 0 ? (
          <div style={{ textAlign:'center', padding:48, color: theme.textMuted }}>
            <p>No questions added for this section yet.</p>
          </div>
        ) : questions[activeSection].map((q, idx) => {
          const qid = q._id.toString();
          const answerText = answers[qid] || '';
          const isAnswered = answerText.trim().length > 0;
          const isSavingThis = savingQ[qid];
          return (
            <div key={q._id} style={{ background: theme.cardBg, borderRadius:12, padding:16, border:`1px solid ${theme.border}`, borderLeft:`4px solid ${isAnswered?secInfo[activeSection].color:theme.border}` }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                <div style={{ width:32, height:32, background: isDark?'#1a2740':'#1e3a5f', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>Q{idx+1}</span>
                </div>
                <p style={{ flex:1, fontSize:14, color: theme.textPrimary, fontWeight:500, margin:0, lineHeight:1.5 }}>{q.text}</p>
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:600, flexShrink:0, background: isAnswered?secInfo[activeSection].bg:theme.hoverBg, color: isAnswered?secInfo[activeSection].color:theme.textMuted }}>
                  {q.marks} mark{q.marks>1?'s':''}
                </span>
              </div>
              <textarea
                style={{ width:'100%', border:`1.5px solid ${isAnswered?secInfo[activeSection].color:theme.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color: theme.textPrimary, background: isReadOnly ? (isDark?'#1a1f2e':'#f8f9fc') : theme.inputBg, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', outline:'none', transition:'border-color 0.2s', opacity: isReadOnly?0.8:1, cursor: isReadOnly?'default':'text' }}
                placeholder={activeSection === 'C' ? 'Describe your approach (optional) — code below 👇' : 'Your answer here...'}
                value={answerText}
                disabled={isReadOnly}
                onChange={e => handleAnswer(qid, e.target.value, activeSection, q.marks)}
                rows={activeSection === 'C' ? 2 : 3}
              />

              {/* Save button — only show when NOT read-only */}
              {!isReadOnly && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
                  <button
                    onClick={() => handleSaveQuestion(qid, activeSection, q.marks)}
                    disabled={isSavingThis}
                    style={{
                      padding:'6px 16px', borderRadius:8, border:'none', cursor: isSavingThis?'default':'pointer',
                      background: isSavingThis ? '#aaa' : (isAnswered ? secInfo[activeSection].color : '#555'),
                      color:'#fff', fontSize:12, fontWeight:700, transition:'all 0.2s',
                      opacity: isSavingThis ? 0.7 : 1,
                    }}>
                    {isSavingThis ? '⏳ Saving...' : '💾 Save'}
                  </button>
                  {isAnswered && <span style={{ fontSize:11, color:'#1D9E75', fontWeight:600 }}>✓ Answered</span>}
                </div>
              )}

              {/* Code Editor toggle */}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => toggleEditor(qid)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                    background: openEditors[qid] ? '#7c6af5' : '#7c6af515',
                    color: openEditors[qid] ? '#fff' : '#7c6af5',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                    border: '1px solid #7c6af540',
                  }}
                >
                  <span>💻</span>
                  <span>{openEditors[qid] ? 'Hide Code Editor' : 'Open Code Editor'}</span>
                  <span style={{ fontSize:11, opacity:0.8 }}>{openEditors[qid] ? ' ▲' : ' ▼'}</span>
                </button>
                {openEditors[qid] && (
                  <div style={{ marginTop: 10 }}>
                    <CodeEditor
                      question={q}
                      courseId={courseId}
                      date={date}
                      token={token}
                      theme={theme}
                      submitted={isReadOnly}
                    />
                  </div>
                )}
              </div>

              {/* Read-only answered indicator */}
              {isReadOnly && isAnswered && <div style={{ fontSize:11, color:'#1D9E75', fontWeight:600, marginTop:6 }}>✓ Answered</div>}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 24px', background: theme.cardBg, borderTop:`1px solid ${theme.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', gap:16, fontSize:13, color: theme.textMuted }}>
          <span>Sec A: {getAnswered('A')}/20</span>
          <span>Sec B: {getAnswered('B')}/20</span>
          <span>Sec C: {getAnswered('C')}/10</span>
          {saving && <span>Saving...</span>}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* Edit mode: show Re-submit button */}
          {isEditing && !deadlinePassed && (
            <button
              style={{ background:'#f5a623', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}
              onClick={handleSubmit}>
              🔄 Re-submit
            </button>
          )}
          {/* Not yet submitted */}
          {!submitted && !deadlinePassed && (
            <button
              style={{ background: isDark?'#1a2740':'#1e3a5f', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}
              onClick={handleSubmit} disabled={saving}>
              {saving ? '⏳ Saving & Submitting...' : 'Submit Assignment'}
            </button>
          )}
          {/* Submitted, not editing, deadline not passed */}
          {submitted && !isEditing && !deadlinePassed && (
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ background:'#E1F5EE', color:'#1D9E75', padding:'10px 20px', borderRadius:10, fontWeight:600, fontSize:14 }}>✓ Submitted</div>
              <button
                style={{ background:'#185FA522', color:'#185FA5', border:'1.5px solid #185FA5', padding:'10px 20px', borderRadius:10, fontWeight:600, fontSize:14, cursor:'pointer' }}
                onClick={handleEditAnswers}>
                ✏️ Edit Answers
              </button>
            </div>
          )}
          {/* Submitted, deadline passed */}
          {submitted && deadlinePassed && (
            <div style={{ background:'#E1F5EE', color:'#1D9E75', padding:'10px 20px', borderRadius:10, fontWeight:600, fontSize:14 }}>✓ Submitted</div>
          )}
          {/* Not submitted, deadline passed */}
          {!submitted && deadlinePassed && (
            <div style={{ background:'#fdecea', color:'#c0392b', padding:'10px 20px', borderRadius:10, fontWeight:600, fontSize:14 }}>⛔ Deadline Passed</div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,85,85,0.3)} 50%{box-shadow:0 0 0 6px rgba(255,85,85,0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
      `}</style>
    </div>
    </>
  );
}