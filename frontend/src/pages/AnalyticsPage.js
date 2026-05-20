import Sidebar from '../components/Sidebar';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';
const AnalyticsPage = () => {
  const { user, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [liveUpdate, setLiveUpdate] = useState(null);
  const { on, off } = useSocket(user?.id || user?._id);

  const fetchAnalytics = useCallback(async () => {
    try {
      const tok = token || localStorage.getItem('lms_token_student') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${tok}` };

      const [attRes, subRes] = await Promise.allSettled([
        api.get(`${API}/api/attendance/stats`, { headers }),
        api.get(`${API}/api/submissions/all`, { headers }),
      ]);

      let attData = {}, subList = [];
      if (attRes.status === 'fulfilled') attData = attRes.value.data;
      if (subRes.status === 'fulfilled') subList = subRes.value.data || [];

      const todayDate = new Date().toISOString().split('T')[0];
      subList = subList.filter(s => s.date <= todayDate);

      const submitted = subList.filter(s => s.status === 'submitted').length;
      const pending   = subList.filter(s => s.status !== 'submitted').length;

      const last30 = attData.last30 || [];
      const last7  = last30.slice(-7);
      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weeklyAtt = last7.map(entry => {
        const d = new Date(entry.date);
        return { day: weekDays[d.getDay()], date: d.getDate(), present: entry.status === 'present' };
      });

      const weeks = [
        { week: 'Week 1', days: last30.slice(0, 7) },
        { week: 'Week 2', days: last30.slice(7, 14) },
        { week: 'Week 3', days: last30.slice(14, 21) },
        { week: 'Week 4', days: last30.slice(21, 30) },
      ];
      const monthlyAtt = weeks.map(w => {
        const classDays   = w.days.filter(d => d.status !== 'no_class');
        const presentDays = w.days.filter(d => d.status === 'present');
        const pct = classDays.length > 0 ? Math.round((presentDays.length / classDays.length) * 100) : 0;
        return { week: w.week, value: pct };
      });

      const now = new Date();
      const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const daysLeft = totalDaysInMonth - dayOfMonth;

      let workingDaysLeft = 0;
      for (let i = 1; i <= daysLeft; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth + i);
        if (d.getDay() !== 0) workingDaysLeft++;
      }

      const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const thisMonthRecords = last30.filter(r => r.date && r.date.startsWith(monthStr));
      const thisMonthClass   = thisMonthRecords.filter(r => r.status !== 'no_class');
      const thisMonthPresent = thisMonthRecords.filter(r => r.status === 'present');
      const currentMonthPct  = thisMonthClass.length > 0
        ? Math.round((thisMonthPresent.length / thisMonthClass.length) * 100)
        : Math.round(attData.attendancePercentage || 0);

      const predictedBest = thisMonthClass.length + workingDaysLeft > 0
        ? Math.round(((thisMonthPresent.length + workingDaysLeft) / (thisMonthClass.length + workingDaysLeft)) * 100)
        : currentMonthPct;
      const predictedWorst = thisMonthClass.length + workingDaysLeft > 0
        ? Math.round((thisMonthPresent.length / (thisMonthClass.length + workingDaysLeft)) * 100)
        : currentMonthPct;
      const currentRate = thisMonthClass.length > 0 ? thisMonthPresent.length / thisMonthClass.length : 0;
      const predictedSame = Math.round(
        ((thisMonthPresent.length + currentRate * workingDaysLeft) / Math.max(thisMonthClass.length + workingDaysLeft, 1)) * 100
      );
      const target = 0.75;
      const needed75 = Math.max(0, Math.ceil(target * (thisMonthClass.length + workingDaysLeft) - thisMonthPresent.length));

      setData({
        attPercent: attData.attendancePercentage || 0,
        present: attData.present || 0,
        absent: attData.absent || 0,
        totalClasses: attData.total || 0,
        streak: attData.currentStreak || 0,
        assignments: { submitted, pending, total: subList.length },
        weeklyAtt, monthlyAtt, subList,
        prediction: {
          currentMonthPct,
          predictedBest: Math.min(predictedBest, 100),
          predictedWorst,
          predictedSame,
          workingDaysLeft,
          needed75,
          daysLeft,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { if (user) fetchAnalytics(); }, [user, fetchAnalytics]);

  // Real-time socket updates
  useEffect(() => {
    const handleAttendanceUpdate = (payload) => {
      setLiveUpdate({ type: 'attendance', msg: `📅 Attendance marked: ${payload.status}`, time: new Date().toLocaleTimeString() });
      setTimeout(() => setLiveUpdate(null), 4000);
      fetchAnalytics();
    };
    const handleSubmissionUpdate = (payload) => {
      setLiveUpdate({ type: 'assignment', msg: `✅ Assignment ${payload.status}!`, time: new Date().toLocaleTimeString() });
      setTimeout(() => setLiveUpdate(null), 4000);
      fetchAnalytics();
    };
    on('attendance-update', handleAttendanceUpdate);
    on('submission-update', handleSubmissionUpdate);
    return () => {
      off('attendance-update', handleAttendanceUpdate);
      off('submission-update', handleSubmissionUpdate);
    };
  }, [on, off, fetchAnalytics]);

  // PDF Download
  const downloadPDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const now = new Date();

      // Header background
      doc.setFillColor(0, 212, 170);
      doc.rect(0, 0, W, 42, 'F');
      doc.setFillColor(124, 106, 245);
      doc.rect(0, 38, W, 5, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('CodeMedha — Progress Report', W / 2, 18, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${user?.name || 'Student'}  |  Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, W / 2, 28, { align: 'center' });

      let y = 52;

      // Section: Attendance Summary
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(10, y, W - 20, 40, 4, 4, 'F');
      doc.setTextColor(60, 60, 80);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('📅  Attendance Summary', 16, y + 10);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const attRows = [
        ['Attendance Rate', `${Math.round(data.attPercent)}%`],
        ['Classes Present', `${data.present}`],
        ['Classes Absent', `${data.absent}`],
        ['Current Streak', `${data.streak} days`],
      ];
      attRows.forEach(([label, val], i) => {
        const col = i < 2 ? 16 : 110;
        const row = i < 2 ? y + 20 + (i * 10) : y + 20 + ((i - 2) * 10);
        doc.setTextColor(100, 100, 120);
        doc.text(label + ':', col, row);
        doc.setTextColor(0, 180, 140);
        doc.setFont('helvetica', 'bold');
        doc.text(val, col + 45, row);
        doc.setFont('helvetica', 'normal');
      });

      y += 50;

      // Section: Assignment Progress
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(10, y, W - 20, 36, 4, 4, 'F');
      doc.setTextColor(60, 60, 80);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('📝  Assignment Progress', 16, y + 10);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const total = data.assignments.total || 1;
      const compPct = Math.round((data.assignments.submitted / total) * 100);
      [
        ['Submitted', `${data.assignments.submitted} / ${total}`],
        ['Pending', `${data.assignments.pending}`],
        ['Completion Rate', `${compPct}%`],
      ].forEach(([label, val], i) => {
        const col = i < 2 ? 16 : 110;
        const row = i < 2 ? y + 20 + (i * 10) : y + 25;
        doc.setTextColor(100, 100, 120);
        doc.text(label + ':', col, row);
        doc.setTextColor(124, 106, 245);
        doc.setFont('helvetica', 'bold');
        doc.text(val, col + 45, row);
        doc.setFont('helvetica', 'normal');
      });

      y += 46;

      // Section: Attendance Prediction
      if (data.prediction) {
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(10, y, W - 20, 48, 4, 4, 'F');
        doc.setTextColor(60, 60, 80);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('📊  Attendance Prediction — This Month', 16, y + 10);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const predRows = [
          ['Current Month %', `${data.prediction.currentMonthPct}%`],
          ['Best Case (attend all)', `${data.prediction.predictedBest}%`],
          ['Current Rate Prediction', `${data.prediction.predictedSame}%`],
          ['Worst Case (miss all)', `${data.prediction.predictedWorst}%`],
          ['Working Days Left', `${data.prediction.workingDaysLeft}`],
        ];
        predRows.forEach(([label, val], i) => {
          const col = i % 2 === 0 ? 16 : 110;
          const row = y + 20 + Math.floor(i / 2) * 10;
          doc.setTextColor(100, 100, 120);
          doc.text(label + ':', col, row);
          doc.setTextColor(0, 150, 255);
          doc.setFont('helvetica', 'bold');
          doc.text(val, col + 55, row);
          doc.setFont('helvetica', 'normal');
        });

        if (data.prediction.needed75 > 0 && data.prediction.predictedSame < 75) {
          doc.setTextColor(245, 100, 50);
          doc.setFontSize(9);
          doc.text(`⚠ Need ${data.prediction.needed75} more class(es) to reach 75% attendance.`, 16, y + 44);
        } else {
          doc.setTextColor(0, 180, 140);
          doc.setFontSize(9);
          doc.text('✅ On track to finish above 75% attendance this month!', 16, y + 44);
        }

        y += 58;
      }

      // Section: Monthly Attendance Chart (text bars)
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(10, y, W - 20, 42, 4, 4, 'F');
      doc.setTextColor(60, 60, 80);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('📈  Monthly Attendance Breakdown', 16, y + 10);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.monthlyAtt.forEach((w, i) => {
        const xStart = 16;
        const barY = y + 20 + (i * 8);
        const barW = (w.value / 100) * (W - 70);
        const barColor = w.value >= 75 ? [0, 180, 140] : w.value >= 50 ? [245, 166, 35] : [245, 85, 85];
        doc.setTextColor(100, 100, 120);
        doc.text(w.week, xStart, barY);
        doc.setFillColor(...barColor);
        doc.rect(xStart + 22, barY - 4, barW, 5, 'F');
        doc.setTextColor(...barColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`${w.value}%`, xStart + 22 + barW + 3, barY);
        doc.setFont('helvetica', 'normal');
      });

      y += 52;

      // Footer
      doc.setFillColor(240, 242, 245);
      doc.rect(0, 277, W, 20, 'F');
      doc.setTextColor(140, 140, 160);
      doc.setFontSize(8);
      doc.text('CodeMedha — Confidential Student Report', W / 2, 287, { align: 'center' });
      doc.text(`Page 1 of 1`, W - 15, 287, { align: 'right' });

      const filename = `LMS_Report_${user?.name?.replace(/ /g,'_') || 'Student'}_${now.toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed. Please refresh and try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const maxMonthly = data ? Math.max(...(data.monthlyAtt || []).map(w => w.value), 1) : 100;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden', background: theme.pageBg, color: theme.textPrimary, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <Sidebar activePath="/analytics" courseId={user&&user.enrolledCourse} />

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '60px 12px 80px' : '32px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 4 }}>📊 Analytics</div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Your real learning progress</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textMuted, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '6px 12px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', animation: 'pulse 2s infinite' }}></div>
              Live
            </div>
            {/* PDF Download button */}
            <button
              onClick={downloadPDF}
              disabled={pdfLoading || !data}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: pdfLoading ? theme.border : 'linear-gradient(135deg, #00d4aa, #7c6af5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: pdfLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: pdfLoading ? 'none' : '0 4px 12px rgba(0,212,170,0.35)' }}>
              {pdfLoading ? '⏳ Generating...' : '📄 Download PDF'}
            </button>
          </div>
        </div>

        {/* Live update toast */}
        {liveUpdate && (
          <div style={{ background: 'linear-gradient(135deg, #00d4aa22, #7c6af522)', border: `1px solid #00d4aa55`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, animation: 'slideIn 0.3s ease' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4aa', flexShrink: 0 }}></div>
            <span style={{ fontSize: 13, color: theme.textSecondary }}>{liveUpdate.msg}</span>
            <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>{liveUpdate.time}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          </div>
        ) : !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <p style={{ color: theme.textMuted }}>Could not load data.</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Attendance Rate',   value: `${Math.round(data.attPercent)}%`,       icon: '📅', color: theme.accent,        sub: `${data.present} present, ${data.absent} absent` },
                { label: 'Current Streak',    value: `${data.streak} days`,                   icon: '🔥', color: theme.accentOrange,   sub: 'Consecutive days present' },
                { label: 'Assignments Done',  value: `${data.assignments.submitted}/${data.assignments.total}`, icon: '✅', color: theme.accentPurple, sub: `${data.assignments.pending} pending` },
                { label: 'Completion Rate',   value: `${data.assignments.total > 0 ? Math.round((data.assignments.submitted / data.assignments.total) * 100) : 0}%`, icon: '🎯', color: '#f56aa0', sub: 'Assignment completion' },
              ].map((s, i) => (
                <div key={i} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0 }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }}></div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Weekly + Monthly Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📅 This Week's Attendance</div>
                {data.weeklyAtt.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: 13 }}>No class data yet for this week.</p>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    {data.weeklyAtt.map((d, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>{d.day}</div>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: d.present ? theme.accent + '22' : theme.border, border: `2px solid ${d.present ? theme.accent : theme.borderHover}`, color: d.present ? theme.accent : theme.textMuted }}>
                          {d.present ? '✓' : '✗'}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>{d.date}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <span style={{ color: theme.accent, fontSize: 12 }}>✓ Present</span>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>✗ Absent</span>
                </div>
              </div>

              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📈 Monthly Attendance %</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 8px' }}>
                  {data.monthlyAtt.map((w, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 , minWidth: 0, overflow: "hidden"}}>
                      <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600 }}>{w.value}%</div>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 140, background: theme.pageBg, borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 1s ease', minHeight: 4, height: `${(w.value / maxMonthly) * 140}px`, background: w.value >= 75 ? `linear-gradient(to top, ${theme.accent}, ${theme.accent}80)` : w.value >= 50 ? 'linear-gradient(to top, #f5a623, #f5a62380)' : 'linear-gradient(to top, #f55, #f5555580)' }}></div>
                      </div>
                      <div style={{ fontSize: 10, color: theme.textMuted, textAlign: 'center', fontWeight: 500 }}>{w.week}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Assignment Progress */}
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📝 Assignment Progress</div>
              {data.assignments.total === 0 ? (
                <p style={{ color: theme.textMuted, fontSize: 13 }}>No assignments found yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 16 : 32 }}>
                  <div style={{ flexShrink: 0 }}>
                    {(() => {
                      const total = data.assignments.total || 1;
                      const sub = data.assignments.submitted || 0;
                      const pend = data.assignments.pending || 0;
                      const r = 60, circ = 2 * Math.PI * r;
                      const subArc = (sub / total) * circ;
                      const pendArc = (pend / total) * circ;
                      return (
                        <svg width="160" height="160" viewBox="0 0 160 160">
                          <circle cx="80" cy="80" r={r} fill="none" stroke={theme.border} strokeWidth="18" />
                          {sub > 0 && <circle cx="80" cy="80" r={r} fill="none" stroke={theme.accentPurple} strokeWidth="18" strokeDasharray={`${subArc} ${circ}`} strokeDashoffset={0} transform="rotate(-90 80 80)" strokeLinecap="round" />}
                          {pend > 0 && <circle cx="80" cy="80" r={r} fill="none" stroke={theme.accentOrange} strokeWidth="18" strokeDasharray={`${pendArc} ${circ}`} strokeDashoffset={-subArc} transform="rotate(-90 80 80)" strokeLinecap="round" />}
                          <text x="80" y="75" textAnchor="middle" fill={theme.textPrimary} fontSize="20" fontWeight="800">{sub}</text>
                          <text x="80" y="92" textAnchor="middle" fill={theme.textSecondary} fontSize="10">Submitted</text>
                        </svg>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    {[
                      { color: theme.accentPurple, val: data.assignments.submitted, label: 'Submitted' },
                      { color: theme.accentOrange, val: data.assignments.pending,   label: 'Pending' },
                      { color: theme.border,        val: data.assignments.total,    label: 'Total' },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }}></div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: theme.textPrimary }}>{l.val}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{l.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: 'flex', flexDirection: 'column', gap: 14, minWidth: 200 }}>
                    {[
                      { label: 'Submitted', value: data.assignments.submitted, total: data.assignments.total, color: theme.accentPurple },
                      { label: 'Pending',   value: data.assignments.pending,   total: data.assignments.total, color: theme.accentOrange },
                    ].map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 12, color: theme.textSecondary, width: 72, flexShrink: 0 }}>{p.label}</div>
                        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", height: 7, background: theme.border, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, transition: 'width 1s ease', width: `${p.total > 0 ? (p.value / p.total) * 100 : 0}%`, background: p.color }}></div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, width: 36, textAlign: 'right', color: p.color }}>{p.total > 0 ? Math.round((p.value / p.total) * 100) : 0}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Prediction */}
            {data.prediction && (
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📊 Attendance Prediction — This Month</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '4px 10px' }}>
                    {data.prediction.workingDaysLeft} working days left
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: '🏆 Best Case',    value: data.prediction.predictedBest,  color: '#1D9E75', desc: 'If you attend all remaining' },
                    { label: '📈 Current Rate', value: data.prediction.predictedSame,  color: theme.accent, desc: 'If you continue as-is' },
                    { label: '⚠️ Worst Case',   value: data.prediction.predictedWorst, color: data.prediction.predictedWorst < 75 ? '#f55' : '#f5a623', desc: 'If you miss all remaining' },
                  ].map((p, i) => (
                    <div key={i} style={{ background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 8 }}>{p.label}</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: p.color, lineHeight: 1, marginBottom: 6 }}>{p.value}%</div>
                      <div style={{ height: 6, background: theme.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', width: `${Math.min(p.value, 100)}%`, background: p.color, borderRadius: 4, transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>{p.desc}</div>
                      <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: p.value >= 75 ? '#1D9E75' : '#ff5555' }}>
                        {p.value >= 75 ? '✅ Above 75%' : '❌ Below 75%'}
                      </div>
                    </div>
                  ))}
                </div>
                {data.prediction.needed75 > 0 && data.prediction.predictedSame < 75 ? (
                  <div style={{ background: '#f5a62315', border: '1px solid #f5a62344', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f5a623' }}>
                    ⚠️ To reach 75% this month, you need to attend at least <strong>{data.prediction.needed75}</strong> more class{data.prediction.needed75 !== 1 ? 'es' : ''} out of the remaining {data.prediction.workingDaysLeft} working days.
                  </div>
                ) : (
                  <div style={{ background: '#1D9E7515', border: '1px solid #1D9E7544', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#1D9E75' }}>
                    🎉 Great! You are on track to finish this month above 75% attendance. Keep it up!
                  </div>
                )}
              </div>
            )}

            {/* Submission History */}
            {data.subList.length > 0 && (
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📋 Submission History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.subList.map((s, i) => {
                    const score = (s.secA?.score || 0) + (s.secB?.score || 0) + (s.secC?.score || 0);
                    const answered = (s.secA?.answered || 0) + (s.secB?.answered || 0) + (s.secC?.answered || 0);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: theme.pageBg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.status === 'submitted' ? theme.accent : theme.accentOrange, flexShrink: 0 }}></div>
                        <div style={{ flex: 1 , minWidth: 0, overflow: "hidden"}}>
                          <div style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 500 }}>Assignment — {s.date}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                            {s.status === 'submitted' ? `✅ Submitted • Score: ${score}` : `⏳ In Progress • ${answered} questions answered`}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: s.status === 'submitted' ? theme.accent : theme.accentOrange, fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AnalyticsPage;