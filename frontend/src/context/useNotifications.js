import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

import { API_BASE } from '../api';
const API = API_BASE;

// Helper: show a browser notification popup
const showNotification = (title, body, icon = '🔔') => {
  if (Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  });
};

// Request permission once
const requestPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const useNotifications = () => {
  const { user, token } = useAuth();
  const lastClassId   = useRef(null);   // track last seen class
  const pendingDates  = useRef(new Set()); // track already-notified pending dates
  const attendanceRef = useRef(false);  // track attendance notification sent today

  useEffect(() => {
    if (!user || !token) return;

    // Ask permission on first load
    requestPermission();

    const headers = { Authorization: `Bearer ${token}` };
    const todayStr = new Date().toISOString().split('T')[0];

    // ─── Poll every 60 seconds ───────────────────────────
    const check = async () => {
      const granted = await requestPermission();
      if (!granted) return;

      try {
        // ── 1. New class uploaded notification ──────────
        const classRes = await axios.get(`${API}/api/classes/all`, { headers });
        const classes  = classRes.data || [];
        const todayClass = classes.find(c => (c.date || c.createdAt || '').split('T')[0] === todayStr);

        if (todayClass && todayClass._id !== lastClassId.current) {
          lastClassId.current = todayClass._id;
          showNotification(
            '🎥 New Class Available!',
            `"${todayClass.title || "Today's Session"}" is now live. Watch it now!`
          );
        }

        // ── 2. Attendance notification ──────────────────
        if (!attendanceRef.current) {
          const attRes = await axios.get(
            `${API}/api/attendance/${user._id}/${todayStr}`,
            { headers }
          );
          const records = attRes.data || [];
          const isPresent = records.some(r => r.status === 'present');

          if (isPresent && !attendanceRef.current) {
            attendanceRef.current = true;
            showNotification(
              '✅ Attendance Marked!',
              `Great! Your attendance for ${todayStr} has been marked. Keep it up! 🔥`
            );
          }
        }

        // ── 3. Pending assignment reminders ─────────────
        const subRes = await axios.get(`${API}/api/submissions/all`, { headers });
        const subs   = (subRes.data || []).filter(s => s.date <= todayStr);

        subs.forEach(s => {
          if (s.status !== 'submitted' && !pendingDates.current.has(s.date)) {
            pendingDates.current.add(s.date);
            const answered = (s.secA?.answered || 0) + (s.secB?.answered || 0) + (s.secC?.answered || 0);
            const total    = (s.secA?.total || 20) + (s.secB?.total || 20) + (s.secC?.total || 10);
            showNotification(
              '📝 Assignment Pending!',
              `Assignment (${s.date}) — ${answered}/${total} answered. Don't forget to submit!`
            );
          }
        });

      } catch (e) {
        // Silently fail — don't break the app
      }
    };

    // Run immediately, then every 60 seconds
    check();
    const interval = setInterval(check, 60 * 1000);

    // Also listen for attendance-marked event (instant notification)
    const onAttendanceMarked = () => {
      if (Notification.permission === 'granted' && !attendanceRef.current) {
        attendanceRef.current = true;
        showNotification(
          '✅ Attendance Marked!',
          `Great! Your attendance for today has been marked. Keep the streak going! 🔥`
        );
      }
    };
    window.addEventListener('attendance-marked', onAttendanceMarked);

    return () => {
      clearInterval(interval);
      window.removeEventListener('attendance-marked', onAttendanceMarked);
    };
  }, [user, token]);
};