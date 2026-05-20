import React, { useState, useEffect, useRef } from 'react';
import api, { API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// ✅ localhost REMOVED — using API_BASE from src/api.js

const isSunday = (dateStr) => new Date(dateStr + 'T00:00:00').getDay() === 0;

// ── Safe normalize: always return an array ──────────────────────────────────
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return [val];   // single attendance object
  return [];
};

export default function AttendanceCalendar({ courseId: courseIdProp }) {
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const today           = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [hoveredDate,  setHoveredDate]  = useState(null);
  const [tooltipPos,   setTooltipPos]   = useState({ top: 0, left: 0, side: 'right' });
  const [dateData,     setDateData]     = useState({});
  const [loading,      setLoading]      = useState(false);
  const [expiredModal, setExpiredModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);

  // Respond to resize
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [backendStats, setBackendStats] = useState({ attendancePercentage: 0, present: 0, absent: 0, total: 0, currentStreak: 0 });

  const gridRef  = useRef(null);
  const courseId = courseIdProp || user?.enrolledCourse;
  const headers  = { Authorization: `Bearer ${token}` };

  const loadBackendStats = async () => {
    try {
      const res = await api.get('/api/attendance/stats');
      setBackendStats(res.data);
    } catch (e) { console.error('stats error', e); }
  };

  useEffect(() => {
    if (courseId) { loadMonthData(); loadBackendStats(); }
  }, [currentMonth, currentYear, courseId]);

  useEffect(() => {
    const handler = () => { loadMonthData(); loadBackendStats(); };
    window.addEventListener('attendance-marked', handler);
    window.addEventListener('assignment-submitted', handler);
    return () => {
      window.removeEventListener('attendance-marked', handler);
      window.removeEventListener('assignment-submitted', handler);
    };
  }, [courseId, currentMonth, currentYear]);

  // Real-time socket: reload when admin marks attendance
  useEffect(() => {
    if (!user) return;
    let s;
    try {
      const { io } = require('socket.io-client');
      s = io(API_BASE, { transports: ['websocket'] });
      s.emit('join', { userId: user._id || user.id });
      s.on('attendance-update', (data) => {
        loadMonthData();
        loadBackendStats();
      });
    } catch(e) {}
    return () => { try { s?.disconnect(); } catch(e) {} };
  }, [user]);

  const getDaysInMonth = () => {
    const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    return days;
  };

  const formatDate = (day) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${currentYear}-${mm}-${dd}`;
  };

  const isToday = (day) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const loadMonthData = async () => {
    try {
      setLoading(true);
      const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
      const result    = {};

      await Promise.all(
        Array.from({ length: totalDays }, (_, i) => i + 1).map(async (day) => {
          const dateStr = formatDate(day);

          if (isSunday(dateStr)) {
            result[dateStr] = { status: 'sunday', att: [], sub: null, cls: null };
            return;
          }

          const cellDate    = new Date(dateStr + 'T00:00:00');
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (cellDate > todayMidnight) {
            result[dateStr] = { status: 'future', att: [], sub: null, cls: null };
            return;
          }

          try {
            const [attRes, subRes, clsRes] = await Promise.all([
              api.get(`/api/attendance/${user._id}/${dateStr}`),
              api.get(`/api/submissions/${user._id}/${dateStr}`),
              api.get(`/api/classes/date/${courseId}/${dateStr}`),
            ]);

            // ── KEY FIX: always normalize to array ──
            const att = toArray(attRes.data);
            const sub = subRes.data;
            const cls = clsRes.data;

            let status = 'none';
            if (att.length > 0) {
              const present = att.some(a => a.status === 'present');
              if (!present) {
                status = 'absent';
              } else {
                status = (sub && sub.status === 'submitted') ? 'complete' : 'pending';
              }
            }
            result[dateStr] = { status, att, sub, cls };
          } catch {
            result[dateStr] = { status: 'none', att: [], sub: null, cls: null };
          }
        })
      );
      setDateData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMonthStats = () => {
    const values      = Object.values(dateData).filter(d => d.status !== 'sunday');
    const presentDays = values.filter(d => d.status === 'complete' || d.status === 'pending').length;
    const absentDays  = values.filter(d => d.status === 'absent').length;
    const doneDays    = values.filter(d => d.status === 'complete').length;
    const classDays   = presentDays + absentDays;
    const attendPct   = classDays > 0 ? Math.round((presentDays / classDays) * 100) : 0;
    const completePct = presentDays > 0 ? Math.round((doneDays / presentDays) * 100) : 0;
    return { presentDays, absentDays, doneDays, classDays, attendPct, completePct };
  };

  const monthStats = getMonthStats();

  const statusColor = (status) => {
    if (status === 'complete') return '#10b981';
    if (status === 'pending')  return '#f59e0b';
    if (status === 'absent')   return '#ef4444';
    return null;
  };

  const handleMouseEnter = (day, e) => {
    setHoveredDate(day);
    const rect     = e.currentTarget.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect();
    const side     = (window.innerWidth - rect.right) < 230 ? 'left' : 'right';
    setTooltipPos({
      top:  rect.top - (gridRect?.top || 0) + rect.height / 2,
      left: side === 'right' ? rect.right - (gridRect?.left || 0) + 10 : rect.left - (gridRect?.left || 0) - 10,
      side,
    });
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const days       = getDaysInMonth();
  const numRows    = Math.ceil(days.length / 7);
  const hoveredStr = hoveredDate ? formatDate(hoveredDate) : null;
  const hData      = hoveredStr ? dateData[hoveredStr] : null;

  const renderTooltip = () => {
    if (!hData) return null;

    // ── KEY FIX: always normalize att to array here too ──
    const status = hData.status;
    const att    = toArray(hData.att);   // safe — never crashes even if undefined
    const sub    = hData.sub;
    const cls    = hData.cls;

    const tooltipStyle = {
      position: 'absolute',
      top: tooltipPos.top,
      left:  tooltipPos.side === 'right' ? tooltipPos.left : undefined,
      right: tooltipPos.side === 'left'  ? `calc(100% - ${tooltipPos.left}px)` : undefined,
      transform: 'translateY(-50%)',
      width: 210, background: '#0f172a', borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      zIndex: 100, pointerEvents: 'none', overflow: 'hidden',
    };

    if (status === 'sunday') {
      return (
        <div style={{ ...tooltipStyle, border: '1.5px solid #33415540', textAlign: 'center', padding: '16px 14px' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>😴</div>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>Sunday — Holiday</div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>No classes scheduled</div>
        </div>
      );
    }

    const color      = statusColor(status) || '#64748b';
    const present    = att.length > 0 && att.some(a => a.status === 'present');
    const hovDateObj = new Date(hoveredStr + 'T00:00:00');
    const todayMid   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const hovMid     = new Date(hovDateObj.getFullYear(), hovDateObj.getMonth(), hovDateObj.getDate());
    const isHovToday = hovMid.getTime() === todayMid.getTime();
    const isHovPast  = hovMid < todayMid;

    const classLabel = !cls ? '○ No Class' : isHovToday ? '🟢 Active Class' : isHovPast ? '⏹ Expired' : '🔜 Upcoming';
    const classColor = !cls ? '#64748b' : isHovToday ? '#10b981' : isHovPast ? '#f59e0b' : '#3b82f6';

    const secAAnswered = (sub?.secA?.answers || []).filter(a => a.isAnswered).length;
    const secBAnswered = (sub?.secB?.answers || []).filter(a => a.isAnswered).length;
    const secCAnswered = (sub?.secC?.answers || []).filter(a => a.isAnswered).length;
    const secATotal    = sub?.secA?.total ?? 20;
    const secBTotal    = sub?.secB?.total ?? 20;
    const secCTotal    = sub?.secC?.total ?? 10;

    return (
      <div style={{ ...tooltipStyle, border: `1.5px solid ${color}40` }}>
        <div style={{ height: 4, background: color }} />
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{hoveredStr}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color+'22', color }}>
              {status === 'complete' ? '✓ Completed' : status === 'pending' ? '⏳ In Progress' : status === 'absent' ? '✗ Absent' : '— No class'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <div style={pill(present && att.length > 0 ? '#10b981' : '#64748b')}>
              {att.length > 0 ? (present ? '✓ Present' : '✗ Absent')
                : cls ? (isHovToday ? '📋 Not marked yet' : isHovPast ? '📋 No record' : '📋 Upcoming') : '📅 No Class'}
            </div>
            <div style={pill(classColor)}>{classLabel}</div>
          </div>
          {att.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: 1, marginBottom: 7 }}>ASSIGNMENT PROGRESS</div>
              {[
                { label: 'Easy',   answered: secAAnswered, total: secATotal, color: '#10b981' },
                { label: 'Medium', answered: secBAnswered, total: secBTotal, color: '#f59e0b' },
                { label: 'Hard',   answered: secCAnswered, total: secCTotal, color: '#8b5cf6' },
              ].map(sec => (
                <div key={sec.label} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#cbd5e1' }}>{sec.label}</span>
                    <span style={{ fontSize: 10, color: sec.color, fontWeight: 700 }}>{sec.answered}/{sec.total}</span>
                  </div>
                  <div style={{ height: 4, background: '#1e293b', borderRadius: 4 }}>
                    <div style={{ height: '100%', borderRadius: 4, background: sec.color, width: `${Math.min((sec.answered / sec.total) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
              {sub && (
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: sub.status === 'submitted' ? '#10b981' : '#f59e0b', textAlign: 'center' }}>
                  {sub.status === 'submitted' ? '✅ Assignment Submitted' : '⏳ Assignment Pending'}
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#475569', textAlign: 'center' }}>Click to open assignment</div>
        </div>
      </div>
    );
  };

  return (
    <>
    <div style={s.outerWrapper}>
      <div style={s.header}>
        <button style={s.navBtn} onClick={prevMonth}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={s.monthTitle}>{MONTHS[currentMonth]} {currentYear}</h2>
          {loading && <span style={s.loadingTxt}>Loading...</span>}
        </div>
        <button style={s.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Stats bar */}
      <div style={s.statsBar}>
        <div style={s.statCard}>
          <div style={s.statRing}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#10b981" strokeWidth="4"
                strokeDasharray={`${(backendStats.attendancePercentage/100)*113} 113`}
                strokeLinecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <span style={s.ringLabel}>{Math.round(backendStats.attendancePercentage)}%</span>
          </div>
          <div>
            <div style={s.statValue}>{backendStats.present} days</div>
            <div style={s.statName}>Attendance</div>
          </div>
        </div>
        <div style={s.statDivider}/>
        <div style={s.statCard}>
          <div style={s.statRing}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#8b5cf6" strokeWidth="4"
                strokeDasharray={`${(monthStats.completePct/100)*113} 113`}
                strokeLinecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <span style={s.ringLabel}>{monthStats.completePct}%</span>
          </div>
          <div>
            <div style={s.statValue}>{monthStats.doneDays} days</div>
            <div style={s.statName}>Completed</div>
          </div>
        </div>
        <div style={s.statDivider}/>
        <div style={s.statCard}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔴</div>
          <div>
            <div style={s.statValue}>{backendStats.absent} days</div>
            <div style={s.statName}>Absent</div>
          </div>
        </div>
        <div style={s.statDivider}/>
        <div style={s.statCard}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔥</div>
          <div>
            <div style={s.statValue}>{backendStats.currentStreak} days</div>
            <div style={s.statName}>Streak</div>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div style={s.dayRow}>
        {DAYS.map(d => (
          <div key={d} style={{ ...s.dayLabel, color: d === 'Sun' ? '#ef4444' : '#94a3b8' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div ref={gridRef} style={{ position: 'relative', flex: 1, minHeight: 0 }} onMouseLeave={() => setHoveredDate(null)}>
        {hoveredDate && renderTooltip()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numRows}, 1fr)`, gap: 5, height: '100%' }}>
          {days.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`}/>;
            const dateStr   = formatDate(day);
            const data      = dateData[dateStr];
            const status    = data?.status || 'none';
            const isSun     = isSunday(dateStr);
            const color     = statusColor(status);
            const todayCell = isToday(day);
            const hovered   = hoveredDate === day;

            const cellMid      = new Date(dateStr + 'T00:00:00');
            const todayMid     = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isCellToday  = cellMid.getTime() === todayMid.getTime();
            const isCellPast   = cellMid < todayMid;
            const hasClass     = !!data?.cls;
            const classDotColor = !hasClass ? null : isCellToday ? '#10b981' : isCellPast ? '#f59e0b' : null;

            if (isSun) {
              return (
                <div key={dateStr} style={{ borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#cbd5e1', cursor: 'default', minHeight: 0, opacity: 0.5 }}
                  onMouseEnter={(e) => handleMouseEnter(day, e)}>
                  <span style={{ fontSize: 15 }}>{day}</span>
                  <span style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>off</span>
                </div>
              );
            }

            if (status === 'future') {
              return (
                <div key={dateStr} style={{ borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#c8d0db', cursor: 'default', minHeight: 0, opacity: 0.45 }}>
                  <span style={{ fontSize: 15 }}>{day}</span>
                </div>
              );
            }

            const bg        = todayCell ? '#1e3a5f' : color ? color+'dd' : hovered ? '#dbeafe' : '#f8fafc';
            const textColor = todayCell ? '#fff'    : color ? '#fff'     : hovered ? '#1e3a5f' : '#475569';

            return (
              <div key={dateStr}
                style={{ borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', userSelect: 'none', background: bg, color: textColor, transform: hovered ? 'scale(1.08)' : 'scale(1)', boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.20)' : color ? '0 2px 8px rgba(0,0,0,0.10)' : 'none', zIndex: hovered ? 10 : 1, transition: 'transform 0.15s ease, box-shadow 0.15s ease', minHeight: 0 }}
                onMouseEnter={(e) => handleMouseEnter(day, e)}
                onClick={() => navigate(`/assignment/${dateStr}`)}>
                <span style={{ fontSize: 15, fontWeight: todayCell ? 700 : 500, lineHeight: 1 }}>{day}</span>
                {!hovered && color      && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', marginTop: 3 }}/>}
                {!hovered && !color && classDotColor && <span style={{ width: 5, height: 5, borderRadius: '50%', background: classDotColor, marginTop: 3 }}/>}
                {hovered && hasClass && (
                  <div
                    onClick={(e) => { e.stopPropagation(); if (isCellPast) setExpiredModal(true); else navigate('/courses'); }}
                    style={{ marginTop: 3, width: 18, height: 18, background: isCellPast ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', border: `1px solid ${isCellPast ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.5)'}` }}>▶</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
        {[{ color: '#10b981', label: 'Completed' }, { color: '#f59e0b', label: 'Present / Pending' }, { color: '#ef4444', label: 'Absent' }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }}/>
            {l.label}
          </div>
        ))}
      </div>
    </div>

    {expiredModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setExpiredModal(false)}>
        <div style={{ background: '#0f172a', border: '1.5px solid #ef444440', borderRadius: 18, padding: '32px 28px', maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>This Class Has Expired</div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 20 }}>This class recording is no longer available. Please contact your admin for access.</div>
          <button onClick={() => setExpiredModal(false)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 12, padding: '8px 24px', borderRadius: 8, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    )}
    </>
  );
}

const pill = (color) => ({ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '3px 0', borderRadius: 6, background: color+'22', color });

const s = {
  outerWrapper: { display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#fff', borderRadius: 16, padding: '14px 12px', boxSizing: 'border-box', overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 },
  monthTitle: { fontSize: 17, fontWeight: 700, color: '#1e3a5f', margin: 0 },
  loadingTxt: { fontSize: 10, color: '#aaa', display: 'block' },
  navBtn: { background: '#f0f4f8', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1e3a5f', padding: '4px 12px', borderRadius: 8, fontWeight: 700, lineHeight: 1.6, minWidth: 40, minHeight: 36 },
  statsBar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', background: '#0f172a', borderRadius: 12, padding: '10px 12px', marginBottom: 10, flexShrink: 0 },
  statCard: { display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: '80px', justifyContent: 'center' },
  statRing: { position: 'relative', flexShrink: 0 },
  ringLabel: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 9, fontWeight: 700, color: '#e2e8f0' },
  statValue: { fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 },
  statName:  { fontSize: 10, color: '#64748b', marginTop: 2 },
  statDivider: { width: 1, height: 30, background: '#1e293b', flexShrink: 0, alignSelf: 'center' },
  dayRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4, flexShrink: 0 },
  dayLabel: { textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '3px 0' },
};