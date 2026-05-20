import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

import { API_BASE } from '../api';
const API = API_BASE;
const ToastContext = createContext();

// ─── Browser Notification helpers ────────────────────────
const requestBrowserPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

const sendBrowserNotification = (title, body) => {
  if (Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    silent: false,
  });
};

export const useToast = () => useContext(ToastContext);

// ─── Individual Toast Card ────────────────────────────────
const Toast = ({ notif, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // slide in
    setTimeout(() => setVisible(true), 10);
    // auto close after 5s
    const t = setTimeout(() => close(), 5000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setLeaving(true);
    setTimeout(() => onClose(notif.id), 350);
  };

  const icons = { class: '🎥', assignment: '📝', attendance: '✅' };
  const colors = { class: '#00d4aa', assignment: '#f5a623', attendance: '#7c6af5' };
  const color = colors[notif.type] || '#00d4aa';
  const icon  = icons[notif.type]  || '🔔';

  return (
    <div
      onClick={notif.action ? () => { notif.action(); close(); } : close}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: '#0d1118',
        border: `1.5px solid ${color}55`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 14,
        padding: '14px 16px',
        width: 320,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}11`,
        cursor: notif.action ? 'pointer' : 'default',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(360px)',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
        position: 'relative',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: color + '20', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
          {notif.title}
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
          {notif.message}
        </div>
        {notif.action && (
          <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 6 }}>
            {notif.actionLabel} →
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={e => { e.stopPropagation(); close(); }}
        style={{
          background: 'none', border: 'none', color: '#475569',
          fontSize: 16, cursor: 'pointer', padding: '0 2px',
          lineHeight: 1, flexShrink: 0,
        }}
      >×</button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3, borderRadius: '0 0 14px 14px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: color,
          animation: 'shrink 5s linear forwards',
        }} />
      </div>
    </div>
  );
};

// ─── Toast Container (fixed top-right) ───────────────────
const ToastContainer = ({ toasts, onClose }) => (
  <div style={{
    position: 'fixed', top: 20, right: 20,
    zIndex: 99999,
    display: 'flex', flexDirection: 'column', gap: 10,
    pointerEvents: 'none',
  }}>
    <style>{`
      @keyframes shrink { from { width: 100%; } to { width: 0%; } }
    `}</style>
    {toasts.map(n => (
      <div key={n.id} style={{ pointerEvents: 'auto' }}>
        <Toast notif={n} onClose={onClose} />
      </div>
    ))}
  </div>
);

// ─── Provider ─────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [toasts, setToasts] = useState([]);
  const seenClasses    = useRef(new Set());
  const seenPending    = useRef(new Set());
  const attendanceSent = useRef(false);
  const todayStr       = new Date().toISOString().split('T')[0];

  const push = useCallback((notif) => {
    const id = Date.now() + Math.random();
    // In-app toast
    setToasts(prev => [...prev, { ...notif, id }]);
    // Browser notification simultaneously
    sendBrowserNotification(notif.title, notif.message);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  // ── Poll backend every 60s ──────────────────────────────
  useEffect(() => {
    if (!user || !token) return;
    const headers = { Authorization: `Bearer ${token}` };
    // Ask browser permission as soon as user logs in
    requestBrowserPermission();

    const check = async () => {
      try {
        // 1. New class uploaded
        const classRes = await axios.get(`${API}/api/classes/all`, { headers });
        const classes  = classRes.data || [];
        const todayClass = classes.find(c => (c.date || c.createdAt || '').split('T')[0] === todayStr);
        if (todayClass && !seenClasses.current.has(todayClass._id)) {
          seenClasses.current.add(todayClass._id);
          push({
            type: 'class',
            title: '🎥 New Class Available!',
            message: `"${todayClass.title || "Today's Session"}" is now live. Watch it now!`,
            actionLabel: 'Watch Now',
            action: null, // navigate handled via click on notification page
          });
        }

        // 2. Attendance marked today
        if (!attendanceSent.current) {
          const attRes = await axios.get(`${API}/api/attendance/${user._id}/${todayStr}`, { headers });
          const records = attRes.data || [];
          if (records.some(r => r.status === 'present')) {
            attendanceSent.current = true;
            push({
              type: 'attendance',
              title: '✅ Attendance Marked!',
              message: 'Your attendance for today is marked. Keep the streak going! 🔥',
              actionLabel: null,
              action: null,
            });
          }
        }

        // 3. Pending assignments
        const subRes = await axios.get(`${API}/api/submissions/all`, { headers });
        const subs   = (subRes.data || []).filter(s => s.date <= todayStr && s.status !== 'submitted');
        subs.forEach(s => {
          if (!seenPending.current.has(s._id)) {
            seenPending.current.add(s._id);
            const answered = (s.secA?.answered || 0) + (s.secB?.answered || 0) + (s.secC?.answered || 0);
            const total    = 50;
            push({
              type: 'assignment',
              title: '📝 Assignment Pending!',
              message: `Assignment (${s.date}) — ${answered}/${total} answered. Don't forget to submit!`,
              actionLabel: 'Continue Now',
              action: null,
            });
          }
        });

      } catch (e) { /* silent */ }
    };

    check();
    const interval = setInterval(check, 60 * 1000);

    // Instant notification when attendance marked
    const onMark = () => {
      if (!attendanceSent.current) {
        attendanceSent.current = true;
        push({
          type: 'attendance',
          title: '✅ Attendance Marked!',
          message: 'Your attendance for today is marked. Keep the streak going! 🔥',
          actionLabel: null,
          action: null,
        });
      }
    };
    window.addEventListener('attendance-marked', onMark);

    return () => {
      clearInterval(interval);
      window.removeEventListener('attendance-marked', onMark);
    };
  }, [user, token, push]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
};