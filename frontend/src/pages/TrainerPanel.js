import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const API     = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const token   = () => localStorage.getItem('token');
const headers = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ─── Colour helpers ──────────────────────────────────────────
const roleColor = (role) =>
  role === 'admin' ? '#e74c3c' : role === 'trainer' || role === 'teacher' ? '#8e44ad' : '#2980b9';

const roleLabel = (role) =>
  role === 'admin' ? '👑 Admin' : role === 'trainer' || role === 'teacher' ? '🎓 Trainer' : '👤 Student';

// visibility options (trainer can pick)
const VIS_OPTIONS = [
  { value: 'everyone', label: '🌐 Everyone',     desc: 'All students + trainer + admin' },
  { value: 'trainer',  label: '👨‍🏫 Trainer only', desc: 'Only trainer & admin see this'  },
  { value: 'admin',    label: '🔒 Admin only',    desc: 'Only admin sees this'            },
];

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

const fmtTime = (d) => {
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// singleton socket
let socketInstance = null;

// ════════════════════════════════════════════════════════════
//  MAIN TRAINER PANEL
// ════════════════════════════════════════════════════════════
export default function TrainerPanel() {
  const [tab, setTab] = useState('dashboard');
  const { user: authUser } = useAuth();
  // Use auth context user (role-based key), fallback to legacy localStorage
  const user = authUser || JSON.parse(localStorage.getItem('lms_user_trainer') || localStorage.getItem('user') || '{}');

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'attendance', label: '✅ Attendance' },
    { id: 'grading',    label: '📝 Grading' },
    { id: 'students',   label: '👥 Students' },
    { id: 'chat',       label: '💬 Group Chat' },
  ];

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.avatarCircle}>{(user.name || 'T')[0].toUpperCase()}</div>
          <div>
            <div style={styles.sidebarName}>{user.name || 'Trainer'}</div>
            <div style={styles.sidebarRole}>{roleLabel(user.role)}</div>
          </div>
        </div>
        <nav>
          {tabs.map(t => (
            <button
              key={t.id}
              style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {tab === 'dashboard'  && <Dashboard />}
        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'grading'    && <GradingTab />}
        {tab === 'students'   && <StudentsTab />}
        {tab === 'chat'       && <GroupChat user={user} />}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/trainer/dashboard`, headers())
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const { totalStudents, attendance, submissions, today, hasAssignment } = stats || {};

  return (
    <div>
      <h2 style={styles.pageTitle}>📊 Dashboard — {today}</h2>

      <div style={styles.cardGrid}>
        <StatCard color="#3498db" icon="👥" label="Total Students" value={totalStudents} />
        <StatCard color="#27ae60" icon="✅" label="Present Today" value={attendance?.present ?? '—'} />
        <StatCard color="#e74c3c" icon="❌" label="Absent Today" value={attendance?.absent ?? '—'} />
        <StatCard color="#f39c12" icon="⏳" label="Not Marked" value={attendance?.notMarked ?? '—'} />
      </div>

      {hasAssignment ? (
        <>
          <h3 style={{ marginTop: 32, color: '#333' }}>📋 Today's Assignment</h3>
          <div style={styles.cardGrid}>
            <StatCard color="#8e44ad" icon="📤" label="Submitted" value={submissions?.submitted ?? 0} />
            <StatCard color="#e67e22" icon="📭" label="Pending" value={submissions?.pending ?? 0} />
            <StatCard color="#c0392b" icon="🔖" label="Ungraded" value={submissions?.ungraded ?? 0} />
          </div>
        </>
      ) : (
        <div style={styles.noData}>📭 No assignment for today</div>
      )}
    </div>
  );
}

function StatCard({ color, icon, label, value }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{label}</div>
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
        (r.data.attendance || []).forEach(a => {
          map[a.student._id] = a.status;
        });
        setLocalStatus(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const markOne = (studentId, status) => {
    setLocalStatus(prev => ({ ...prev, [studentId]: status }));
  };

  const saveOne = async (studentId) => {
    try {
      await axios.post(`${API}/trainer/attendance/mark`, {
        studentId, date, status: localStatus[studentId] || 'absent'
      }, headers());
      showToast('✅ Saved!');
    } catch (e) { showToast('❌ Error saving'); }
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
    } catch (e) { showToast('❌ Error saving'); }
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
                          <button
                            key={s}
                            onClick={() => markOne(row.student._id, s)}
                            style={{
                              ...styles.statusBtn,
                              background: st === s
                                ? (s === 'present' ? '#27ae60' : '#e74c3c')
                                : '#eee',
                              color: st === s ? '#fff' : '#333',
                            }}
                          >
                            {s === 'present' ? '✅ Present' : '❌ Absent'}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {row.watchedDuration ? `${row.watchedDuration} min` : '—'}
                    </td>
                    <td style={styles.td}>
                      <button onClick={() => saveOne(row.student._id)} style={styles.smallBtn}>Save</button>
                    </td>
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
  const [data, setData]   = useState(null);
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
    setData(prev => ({
      ...prev,
      submissions: prev.submissions.map(s => s._id === updatedSub._id ? updatedSub : s),
    }));
    showToast('✅ Graded & saved!');
    setSelected(null);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h2 style={styles.pageTitle}>📝 Assignment Grading</h2>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.toolbar}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.dateInput} />
      </div>

      {!data?.assignment ? (
        <div style={styles.noData}>📭 No assignment found for {date}</div>
      ) : selected ? (
        <GradeForm
          submission={selected}
          questions={data.assignment.questions}
          onBack={() => setSelected(null)}
          onSaved={onGraded}
        />
      ) : (
        <>
          <div style={{ marginBottom: 12, color: '#555' }}>
            📋 <strong>{data.assignment.title}</strong> — {data.submissions.length} submissions
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Student</th>
                  <th style={styles.th}>Submitted</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((sub, i) => (
                  <tr key={sub._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <strong>{sub.userId?.name}</strong>
                      <div style={{ fontSize: 12, color: '#888' }}>{sub.userId?.email}</div>
                    </td>
                    <td style={styles.td}>
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : '—'}
                    </td>
                    <td style={styles.td}>
                      {sub.manualScore !== null && sub.manualScore !== undefined
                        ? <strong style={{ color: '#27ae60' }}>{sub.manualScore}</strong>
                        : <span style={{ color: '#aaa' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {sub.gradedAt
                        ? <span style={styles.badge('#27ae60')}>✅ Graded</span>
                        : sub.status === 'submitted'
                        ? <span style={styles.badge('#e67e22')}>⏳ Pending</span>
                        : <span style={styles.badge('#aaa')}>📝 In Progress</span>}
                    </td>
                    <td style={styles.td}>
                      {sub.status === 'submitted' && (
                        <button onClick={() => setSelected(sub)} style={styles.smallBtn}>
                          {sub.gradedAt ? '✏️ Re-grade' : '📋 Grade'}
                        </button>
                      )}
                    </td>
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
      const questionScores = questions.map((q, i) => ({
        questionIndex: i,
        score: Number(scores[i]) || 0,
        maxScore: 10,
        feedback: '',
      }));
      const res = await axios.patch(
        `${API}/trainer/submissions/${submission._id}/grade`,
        { manualScore: Number(manualScore) || 0, trainerFeedback: feedback, questionScores },
        headers()
      );
      onSaved(res.data.submission);
    } catch (e) {
      alert('Error saving: ' + (e.response?.data?.message || e.message));
    }
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
          <div style={styles.answerBox}>
            <strong>Answer:</strong>
            <p style={styles.answerText}>{answers[i] || <em style={{ color: '#aaa' }}>No answer</em>}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 13 }}>Score (out of 10):</label>
            <input
              type="number" min="0" max="10" value={scores[i] ?? ''}
              onChange={e => setScores(prev => ({ ...prev, [i]: e.target.value }))}
              style={styles.scoreInput}
            />
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
          <input
            type="number" value={manualScore} disabled={autoTotal}
            onChange={e => setManualScore(e.target.value)}
            style={{ ...styles.scoreInput, width: 80 }}
          />
          <span style={{ color: '#888', fontSize: 13 }}>/ {questions.length * 10}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Overall Feedback:</label>
          <textarea
            value={feedback} rows={3}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Write feedback for the student…"
            style={styles.feedbackArea}
          />
        </div>
        <button onClick={save} disabled={saving} style={{ ...styles.btn, background: '#27ae60', marginTop: 12 }}>
          {saving ? '💾 Saving…' : '💾 Save Grade'}
        </button>
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

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loader />;

  return (
    <div>
      <h2 style={styles.pageTitle}>👥 Students</h2>
      {selected
        ? <StudentDetail student={selected} onBack={() => setSelected(null)} />
        : (
          <>
            <input
              placeholder="🔍 Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            <div style={styles.studentGrid}>
              {filtered.map(s => (
                <div key={s._id} style={styles.studentCard} onClick={() => setSelected(s)}>
                  <div style={styles.avatarLg}>{s.name[0].toUpperCase()}</div>
                  <div style={styles.studentName}>{s.name}</div>
                  <div style={styles.studentEmail}>{s.email}</div>
                  {s.phone && <div style={styles.studentPhone}>📞 {s.phone}</div>}
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
        {student.phone && <div style={{ color: '#888', fontSize: 13 }}>📞 {student.phone}</div>}
      </div>

      <h4 style={{ marginTop: 24 }}>📋 Assignment History</h4>
      {loading ? <Loader /> : subs.length === 0 ? (
        <div style={styles.noData}>No submissions yet</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Assignment</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Score</th>
                <th style={styles.th}>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub, i) => (
                <tr key={sub._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={styles.td}>{sub.assignmentId?.title || '—'}</td>
                  <td style={styles.td}>{sub.assignmentId?.date || '—'}</td>
                  <td style={styles.td}>
                    {sub.status === 'submitted'
                      ? <span style={styles.badge('#27ae60')}>✅ Submitted</span>
                      : <span style={styles.badge('#e67e22')}>⏳ In Progress</span>}
                  </td>
                  <td style={styles.td}>
                    {sub.manualScore !== null && sub.manualScore !== undefined ? sub.manualScore : '—'}
                  </td>
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
//  GROUP CHAT — Socket.IO + ChatMessage model
// ════════════════════════════════════════════════════════════
function GroupChat({ user }) {
  const [courses,     setCourses]     = useState([]);
  const [courseId,    setCourseId]    = useState('');
  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [visibility,  setVisibility]  = useState('everyone');
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [connected,   setConnected]   = useState(false);
  const [typing,      setTyping]      = useState(null);
  const [showVis,     setShowVis]     = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const typTimer   = useRef(null);

  const myId   = user._id || user.id;
  const myName = user.name || 'Trainer';
  const myRole = user.role || 'trainer';

  // load courses list on mount
  useEffect(() => {
    axios.get(`${API.replace('/api', '')}/api/courses`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => {
        setCourses(r.data || []);
        if (r.data?.length === 1) setCourseId(r.data[0]._id);
      })
      .catch(() => {});
  }, []);

  // load messages when courseId changes
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    axios.get(`${API.replace('/api', '')}/api/chat/${courseId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => setMessages(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  // socket setup
  useEffect(() => {
    if (!courseId || !myId) return;

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
    const onMsg        = (msg) => {
      if (canSee(msg, user)) {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
      }
    };
    const onDeleted    = ({ _id }) => setMessages(prev => prev.filter(m => m._id !== _id));
    const onTyping     = ({ userName: n }) => {
      if (n !== myName) {
        setTyping(n);
        clearTimeout(typTimer.current);
        typTimer.current = setTimeout(() => setTyping(null), 3000);
      }
    };
    const onStopTyping = () => setTyping(null);

    s.on('connect',              onConnect);
    s.on('disconnect',           onDisconnect);
    s.on('chat-message',         onMsg);
    s.on('chat-message-deleted', onDeleted);
    s.on('user-typing',          onTyping);
    s.on('user-stop-typing',     onStopTyping);

    s.emit('join-course-chat', { courseId, userId: myId, userName: myName, userRole: myRole });
    setConnected(s.connected);

    return () => {
      s.off('connect',              onConnect);
      s.off('disconnect',           onDisconnect);
      s.off('chat-message',         onMsg);
      s.off('chat-message-deleted', onDeleted);
      s.off('user-typing',          onTyping);
      s.off('user-stop-typing',     onStopTyping);
      s.emit('leave-course-chat', { courseId });
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
    socketInstance?.emit('send-chat-message', {
      courseId,
      senderId:   myId,
      senderName: myName,
      senderRole: myRole,
      message:    msg,
      visibility,
    });
    socketInstance?.emit('stop-typing', { courseId });
    setText('');
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMsg = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await axios.delete(
        `${API.replace('/api', '')}/api/chat/${courseId}/${msgId}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      // deletion broadcast via socket; local state updated by 'chat-message-deleted'
    } catch { alert('Cannot delete'); }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socketInstance?.emit('typing', { courseId, userName: myName });
    clearTimeout(typTimer.current);
    typTimer.current = setTimeout(() => socketInstance?.emit('stop-typing', { courseId }), 1500);
  };

  const currentVis = VIS_OPTIONS.find(v => v.value === visibility);

  return (
    <div style={styles.chatWrapper}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <h2 style={{ ...styles.pageTitle, margin: 0 }}>💬 Group Chat</h2>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#27ae60' : '#e74c3c', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: '#888' }}>{connected ? 'Live' : 'Connecting…'}</span>

        {/* Course selector (shown if multiple courses) */}
        {courses.length > 1 && (
          <select
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
          >
            <option value="">— Select course —</option>
            {courses.map(c => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {!courseId ? (
        <div style={styles.noData}>
          {courses.length === 0 ? '⏳ Loading courses…' : '📋 Select a course to open chat'}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={styles.chatBox}>
            {loading ? <Loader /> : messages.length === 0 ? (
              <div style={styles.noData}>No messages yet. Say hello! 👋</div>
            ) : (
              messages.map((msg, i) => {
                const isMe     = msg.senderId?.toString() === myId?.toString();
                const prev     = messages[i - 1];
                const showMeta = !prev || prev.senderId?.toString() !== msg.senderId?.toString() ||
                  new Date(msg.createdAt) - new Date(prev.createdAt) > 300000;

                const visBadge = msg.visibility !== 'everyone'
                  ? VIS_OPTIONS.find(v => v.value === msg.visibility) : null;

                return (
                  <div key={msg._id || i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: showMeta ? 12 : 2 }}>
                    {!isMe && showMeta && (
                      <div style={{ ...styles.msgAvatar, background: roleColor(msg.senderRole) }}>
                        {(msg.senderName || '?')[0].toUpperCase()}
                      </div>
                    )}
                    {!isMe && !showMeta && <div style={{ width: 32, flexShrink: 0 }} />}

                    <div style={{ maxWidth: '65%' }}>
                      {showMeta && (
                        <div style={styles.msgMeta}>
                          <span style={{ color: roleColor(msg.senderRole), fontWeight: 600 }}>
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          {msg.senderRole !== 'student' && (
                            <span style={styles.roleTag(msg.senderRole)}>{msg.senderRole}</span>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        <div style={{ ...styles.msgBubble, background: isMe ? '#8e44ad' : '#f0f0f0', color: isMe ? '#fff' : '#222' }}>
                          {msg.message}
                          {/* trainer/admin can delete any message */}
                          <button
                            onClick={() => deleteMsg(msg._id)}
                            style={{ ...styles.deleteMsgBtn, color: isMe ? 'rgba(255,255,255,0.5)' : '#ccc' }}
                            title="Delete"
                          >×</button>
                        </div>
                        <div style={{ ...styles.msgTime, textAlign: isMe ? 'right' : 'left' }}>
                          {fmtTime(msg.createdAt)}
                        </div>
                      </div>
                      {visBadge && (
                        <div style={{ fontSize: 10, color: '#8e44ad', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                          {visBadge.label}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {typing && (
              <div style={{ fontSize: 12, color: '#888', padding: '6px 4px' }}>
                ✏️ {typing} is typing…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ marginTop: 12 }}>
            {/* Visibility picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
              <span style={{ fontSize: 12, color: '#888' }}>Send to:</span>
              <button
                onClick={() => setShowVis(v => !v)}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}
              >
                {currentVis.label} ▾
              </button>
              <span style={{ fontSize: 11, color: '#aaa' }}>{currentVis.desc}</span>
              {showVis && (
                <div style={{ position: 'absolute', bottom: '130%', left: 64, background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: 8, zIndex: 999, minWidth: 240, boxShadow: '0 4px 20px #0002' }}>
                  {VIS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setVisibility(opt.value); setShowVis(false); }}
                      style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: visibility === opt.value ? '#f0eaf8' : 'transparent', color: visibility === opt.value ? '#8e44ad' : '#333', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: visibility === opt.value ? 700 : 400, borderRadius: 8, marginBottom: 2 }}>
                      {opt.label}
                      <div style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.chatInput}>
              <input
                ref={inputRef}
                value={text}
                onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Type a message… (Enter to send)"
                style={styles.chatTextInput}
                disabled={sending}
              />
              <button onClick={send} disabled={sending || !text.trim()} style={styles.sendBtn}>
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
//  HELPERS
// ════════════════════════════════════════════════════════════
function Loader() {
  return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Loading…</div>;
}

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const styles = {
  wrapper: { display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f5f6fa' },
  sidebar: { width: 220, background: '#1a1a2e', display: 'flex', flexDirection: 'column', padding: '24px 0' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  sidebarName: { color: '#fff', fontWeight: 600, fontSize: 14 },
  sidebarRole: { color: '#aaa', fontSize: 12, marginTop: 2 },
  avatarCircle: { width: 40, height: 40, borderRadius: '50%', background: '#8e44ad', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  navBtn: { width: '100%', padding: '12px 20px', background: 'none', border: 'none', color: '#ccc', textAlign: 'left', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' },
  navBtnActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', borderLeft: '3px solid #8e44ad' },
  main: { flex: 1, padding: '32px', overflowY: 'auto' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 24, marginTop: 0 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 },
  statCard: { background: '#fff', borderRadius: 10, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  dateInput: { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  smallBtn: { padding: '5px 12px', borderRadius: 5, border: 'none', background: '#3498db', color: '#fff', cursor: 'pointer', fontSize: 13 },
  summaryBadge: { background: '#eee', borderRadius: 20, padding: '4px 12px', fontSize: 13, color: '#555' },
  tableWrap: { overflowX: 'auto', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { padding: '12px 16px', background: '#f0f0f0', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#555' },
  td: { padding: '12px 16px', fontSize: 14, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
  statusBtns: { display: 'flex', gap: 6 },
  statusBtn: { padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  badge: (color) => ({ background: color, color: '#fff', padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }),
  noData: { textAlign: 'center', padding: 40, color: '#aaa', fontSize: 15 },
  toast: { position: 'fixed', top: 20, right: 20, background: '#27ae60', color: '#fff', padding: '10px 20px', borderRadius: 8, zIndex: 9999, fontWeight: 600 },
  searchInput: { width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' },
  studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  studentCard: { background: '#fff', borderRadius: 10, padding: 20, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' },
  avatarLg: { width: 56, height: 56, borderRadius: '50%', background: '#3498db', color: '#fff', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  studentName: { fontWeight: 600, fontSize: 15, color: '#222' },
  studentEmail: { fontSize: 12, color: '#888', marginTop: 4 },
  studentPhone: { fontSize: 12, color: '#888', marginTop: 4 },
  studentDetailCard: { background: '#fff', borderRadius: 10, padding: 24, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'inline-block' },
  backBtn: { padding: '7px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555' },
  gradeForm: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  questionCard: { border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 },
  qText: { fontWeight: 600, color: '#1a1a2e', marginBottom: 8 },
  answerBox: { background: '#f9f9f9', borderRadius: 6, padding: 10 },
  answerText: { margin: '6px 0 0', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  scoreInput: { width: 60, padding: '4px 8px', borderRadius: 5, border: '1px solid #ddd', fontSize: 14, textAlign: 'center' },
  gradeSummary: { background: '#f5f6fa', borderRadius: 8, padding: 20, marginTop: 8 },
  feedbackArea: { width: '100%', borderRadius: 6, border: '1px solid #ddd', padding: 10, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' },
  chatWrapper: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' },
  chatBox: { flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '16px', marginBottom: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' },
  chatInput: { display: 'flex', gap: 10 },
  chatTextInput: { flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid #ddd', fontSize: 14, outline: 'none' },
  sendBtn: { width: 48, height: 48, borderRadius: '50%', background: '#8e44ad', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  msgAvatar: { width: 32, height: 32, borderRadius: '50%', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgMeta: { fontSize: 12, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 },
  msgBubble: { padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, position: 'relative', wordBreak: 'break-word' },
  msgTime: { fontSize: 11, color: '#aaa', marginTop: 3, paddingLeft: 4, paddingRight: 4 },
  deleteMsgBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 0 0 8px', verticalAlign: 'middle' },
  roleTag: (role) => ({ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: roleColor(role), color: '#fff', fontWeight: 600 }),
};