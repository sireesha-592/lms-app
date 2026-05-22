import Sidebar from '../components/Sidebar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../context/ThemeContext';
import { io } from 'socket.io-client';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';
const VIS_OPTIONS = [
  { value: 'everyone', label: '🌐 Everyone',    desc: 'All students + trainer + admin', color: '#00d4aa' },
  { value: 'trainer',  label: '👨‍🏫 Trainer only', desc: 'Only trainer & admin see this',  color: '#7c6af5' },
  { value: 'admin',    label: '🔒 Admin only',   desc: 'Only admin sees this',            color: '#f5a623' },
];

const canSee = (msg, user) => {
  if (!user) return false;
  const role = user.role || 'student';
  const uid  = user._id || user.id;
  if (role === 'admin') return true;
  if (msg.visibility === 'everyone') return true;
  if (msg.visibility === 'trainer' && (role === 'teacher' || role === 'trainer')) return true;
  if ((msg.visibility === 'trainer' || msg.visibility === 'admin') && (msg.senderId === uid || msg.senderId?.toString() === uid?.toString())) return true;
  // Students always see 'everyone' messages; return false for trainer/admin-only
  return false;
};

const fmtTime = (d) => {
  const dt = new Date(d), now = new Date();
  if (dt.toDateString() === now.toDateString())
    return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
         dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export default function GroupChatPage() {
  const { courseId: urlCourseId } = useParams();
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  // Always verify courseId via server — fixes stale localStorage/URL params
  // Redirects to correct courseId if URL has a stale/wrong one
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [courseId, setCourseId] = useState(urlCourseId || '');
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!token || urlCourseId) return;
    api.get(`${API}/api/chat/active-course`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const serverCourseId = r.data?.courseId;
        if (serverCourseId && serverCourseId !== urlCourseId) {
          // URL has wrong/stale courseId — redirect to correct one
          navigate(`/chat/${serverCourseId}`, { replace: true });
        } else if (serverCourseId) {
          setCourseId(serverCourseId);
        }
      })
      .catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [visibility,  setVisibility]  = useState('everyone');
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [connected,   setConnected]   = useState(false);
  const [typing,      setTyping]      = useState(null);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [courseInfo,  setCourseInfo]  = useState(null);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const typTimer  = useRef(null);
  const authRef   = useRef({ Authorization: `Bearer ${token}` });
  const socketRef = useRef(null);
  const userRef   = useRef(user);  // always-fresh user reference for socket callbacks

  // Keep refs fresh
  useEffect(() => {
    authRef.current = { Authorization: `Bearer ${token}` };
  }, [token]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const userId   = user?._id || user?.id;
  const userName = user?.name || 'Student';
  const userRole = user?.role || 'student';

  // Load message history + course info
  useEffect(() => {
    if (!courseId) return;
    if (!token) {
      setLoadError('Not logged in. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    const fetchMessages = () =>
      api.get(`${API}/api/chat/${courseId}`, { headers: authRef.current })
        .then(r => { setMessages(r.data || []); setLoadError(''); })
        .catch(err => {
          const status = err.response?.status;
          if (status === 403) {
            setLoadError('You are not enrolled in this course. Ask your admin to enroll you.');
        } else if (status === 404) {
          setLoadError('Course not found. Please go back and try again.');
        } else if (status === 401) {
          setLoadError('Session expired. Please log in again.');
        } else {
          setLoadError('Could not load messages. Make sure the server is running.');
        }
      })
      .finally(() => setLoading(false));

    fetchMessages();

    api.get(`${API}/api/courses`, { headers: authRef.current })
      .then(r => {
        const c = (r.data || []).find(c => c._id === courseId);
        if (c) setCourseInfo(c);
      })
      .catch(() => {});
  }, [courseId, token]);

  // Socket setup
  useEffect(() => {
    if (!userId || !courseId || !token) return;

    // Always create a fresh socket for this mount
    const s = io('https://codemedha-production-47c1.up.railway.app', {
      transports: ['websocket'],
      reconnection: true,
      auth: { token },
    });
    socketRef.current = s;

    const joinRoom = () => s.emit('join-course-chat', { courseId, userId, userName, userRole });
    const onConnect    = () => { setConnected(true); joinRoom(); };
    const onReconnect  = () => { joinRoom(); };
    const onDisconnect = () => setConnected(false);
    const onMessage    = (msg) => {
      if (canSee(msg, userRef.current)) {
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
    s.on('reconnect',            onReconnect);
    s.on('disconnect',           onDisconnect);
    s.on('chat-message',         onMessage);
    s.on('chat-message-deleted', onDeleted);
    s.on('user-typing',          onTyping);
    s.on('user-stop-typing',     onStopTyping);

    if (s.connected) { setConnected(true); s.emit('join-course-chat', { courseId, userId, userName, userRole }); }

    return () => {
      s.off('connect',              onConnect);
      s.off('reconnect',            onReconnect);
      s.off('disconnect',           onDisconnect);
      s.off('chat-message',         onMessage);
      s.off('chat-message-deleted', onDeleted);
      s.off('user-typing',          onTyping);
      s.off('user-stop-typing',     onStopTyping);
      s.emit('leave-course-chat', { courseId });
      s.disconnect();
      socketRef.current = null;
    };
  }, [userId, courseId, token]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setInput('');
    socketRef.current?.emit('send-chat-message', {
      courseId, senderId: userId, senderName: userName,
      senderRole: userRole, message: msg, visibility,
    });
    socketRef.current?.emit('stop-typing', { courseId });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTyping = e => {
    setInput(e.target.value);
    socketRef.current?.emit('typing', { courseId, userName });
    clearTimeout(typTimer.current);
    typTimer.current = setTimeout(() => socketRef.current?.emit('stop-typing', { courseId }), 1500);
  };

  const currentVis = VIS_OPTIONS.find(v => v.value === visibility);

  const NAV_ITEMS = [
    { icon: '⊞', label: 'Dashboard',     path: '/dashboard' },
    { icon: '📅', label: 'Attendance',    path: '/attendance' },
    { icon: '🎥', label: 'Classes',       path: '/courses' },
    { icon: '📚', label: 'My Course',     path: '/my-course' },
    { icon: '📝', label: 'Assignments',   path: '/assignments' },
    { icon: '🔔', label: 'Notifications', path: '/notifications' },
    { icon: '📊', label: 'Analytics',     path: '/analytics' },
    { icon: '🏆', label: 'Leaderboard',   path: '/leaderboard' },
    { icon: '💬', label: 'Group Chat',    path: `/chat/${courseId}`, active: true },
    { icon: '📅', label: 'Weekly Report', path: '/weekly-report' },
    { icon: '👤', label: 'Profile',       path: '/profile' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.pageBg, color: theme.textPrimary, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      {/* ── Sidebar ── */}
      <PageHeader />
      <Sidebar activePath="/chat" courseId={courseId} />

      {/* ── Main Chat ── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', paddingTop: 64, marginLeft: isMobile ? 0 : 240 }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${theme.border}`, background: theme.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#7c6af5,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💬</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{courseInfo?.title || 'Group Chat'}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#00d4aa' : '#f55', display: 'inline-block' }} />
                {connected ? 'Live — real-time' : 'Connecting…'}
                <span>· {messages.length} messages</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '5px 14px' }}>🔒 Course-only</div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Loading spinner */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minWidth: 0, overflow: "hidden", flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${theme.border}`, borderTop: `3px solid #7c6af5`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: theme.textMuted }}>Loading messages…</span>
            </div>
          )}

          {/* Error state */}
          {!loading && loadError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, overflow: "hidden", gap: 14, padding: 40 }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary, textAlign: 'center' }}>Cannot load chat</div>
              <div style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>{loadError}</div>
              <button onClick={() => navigate('/courses')}
                style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#00d4aa,#7c6af5)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ← Back to Courses
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadError && messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, overflow: "hidden", gap: 12, color: theme.textMuted }}>
              <div style={{ fontSize: 52 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>No messages yet</div>
              <div style={{ fontSize: 13 }}>Be the first to say something!</div>
            </div>
          )}

          {/* Messages */}
          {!loading && !loadError && messages.map((msg, i) => {
            const isMe       = msg.senderId === userId || msg.senderId?.toString() === userId;
            const prev       = messages[i - 1];
            const showSender = !prev || prev.senderId?.toString() !== msg.senderId?.toString() || new Date(msg.createdAt) - new Date(prev.createdAt) > 300000;
            const visBadge   = msg.visibility !== 'everyone' ? VIS_OPTIONS.find(v => v.value === msg.visibility) : null;

            return (
              <div key={msg._id || i} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: showSender ? 14 : 2 }}>
                {/* Avatar */}
                {!isMe && showSender && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: msg.senderRole === 'admin' ? 'linear-gradient(135deg,#f5a623,#f56aa0)' : msg.senderRole === 'teacher' ? 'linear-gradient(135deg,#7c6af5,#00d4aa)' : 'linear-gradient(135deg,#00d4aa,#7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                {!isMe && !showSender && <div style={{ width: 32, flexShrink: 0 }} />}

                <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {showSender && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>{isMe ? 'You' : msg.senderName}</span>
                      {msg.senderRole !== 'student' && (
                        <span style={{ fontSize: 10, background: msg.senderRole === 'admin' ? '#f5a62322' : '#7c6af522', color: msg.senderRole === 'admin' ? '#f5a623' : '#7c6af5', border: `1px solid ${msg.senderRole === 'admin' ? '#f5a62344' : '#7c6af544'}`, borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>
                          {msg.senderRole === 'admin' ? '👑 Admin' : '👨‍🏫 Trainer'}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ padding: '10px 14px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', background: isMe ? 'linear-gradient(135deg,#00d4aa,#7c6af5)' : theme.cardBg, border: isMe ? 'none' : `1px solid ${theme.border}`, color: isMe ? '#fff' : theme.textPrimary, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', paddingBottom: 4 }}>{fmtTime(msg.createdAt)}</div>
                  </div>
                  {visBadge && (
                    <div style={{ fontSize: 10, color: visBadge.color, background: visBadge.color + '15', border: `1px solid ${visBadge.color}30`, borderRadius: 10, padding: '2px 8px', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                      {visBadge.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '4px 16px 16px 16px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: theme.textMuted, animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{typing} is typing…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area — hide if there's an error */}
        {!loadError && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.border}`, background: theme.cardBg, flexShrink: 0 }}>
            {/* Visibility selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative' }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Send to:</span>
              <button onClick={() => setShowVisMenu(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 20, border: `1px solid ${currentVis.color}55`, background: currentVis.color + '15', color: currentVis.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {currentVis.label} <span style={{ fontSize: 10 }}>▼</span>
              </button>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{currentVis.desc}</span>

              {showVisMenu && (
                <div style={{ position: 'absolute', bottom: '130%', left: 64, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 8, zIndex: 999, minWidth: 250, boxShadow: '0 8px 32px #0006' }}>
                  {VIS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setVisibility(opt.value); setShowVisMenu(false); }}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: visibility === opt.value ? opt.color + '20' : 'transparent', color: visibility === opt.value ? opt.color : theme.textPrimary, fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: visibility === opt.value ? 700 : 400, marginBottom: 2 }}>
                      {opt.label}
                      <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400, marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                style={{ flex: 1, minWidth: 0, overflow: "hidden", padding: '12px 16px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.textPrimary, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                style={{ width: 46, height: 46, borderRadius: 12, border: 'none', background: !input.trim() ? theme.border : 'linear-gradient(135deg,#00d4aa,#7c6af5)', color: '#fff', fontSize: 18, cursor: !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                {sending ? '⏳' : '➤'}
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}