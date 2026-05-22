import Sidebar from '../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';

const BADGES = [
  { id: 'first_class',    icon: '🎓', label: 'First Class',    desc: 'Watched your first class',     color: '#7c6af5' },
  { id: 'week_streak',   icon: '🔥', label: 'Week Warrior',   desc: '7-day attendance streak',       color: '#f5a623' },
  { id: 'perfect_month', icon: '⭐', label: 'Perfect Month',  desc: '100% attendance in a month',    color: '#f5e642' },
  { id: 'assignment_ace',icon: '✅', label: 'Assignment Ace', desc: 'Submitted 5+ assignments',      color: '#00d4aa' },
  { id: 'early_bird',    icon: '🌅', label: 'Early Bird',     desc: 'Attendance 80%+',               color: '#f56aa0' },
  { id: 'consistent',   icon: '💎', label: 'Consistent',     desc: '30-day streak',                 color: '#00cfff' },
];

const ProfilePage = () => {
  const { user, logout, token } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats]             = useState({ attendance: 0, streak: 0, total: 0, totalClasses: 0, present: 0, absent: 0, submitted: 0, pending: 0 });
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('overview');
  const [parentName, setParentName]   = useState(user?.parentName  || '');
  const [parentPhone, setParentPhone] = useState(user?.parentPhone || '');
  const [savingParent, setSavingParent] = useState(false);
  const [parentSaved, setParentSaved]   = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { if (user) fetchProfileData(); }, [user]);

  const fetchProfileData = async () => {
    try {
      const tok = token || localStorage.getItem('lms_token_student') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${tok}` };

      const [attRes, subRes, classRes] = await Promise.allSettled([
        api.get(`${API}/api/attendance/stats`, { headers }),
        api.get(`${API}/api/submissions/all`, { headers }),
        api.get(`${API}/api/classes/all`, { headers }),
      ]);

      let attData = {}, subList = [], classList = [];
      if (attRes.status  === 'fulfilled') { attData = attRes.value.data; console.log('✅ Attendance data:', attData); }
      else console.error('❌ Attendance API error:', attRes.reason?.response?.status, attRes.reason?.response?.data || attRes.reason?.message);
      if (subRes.status  === 'fulfilled') { subList = Array.isArray(subRes.value.data) ? subRes.value.data : []; console.log('✅ Submissions:', subList.length); }
      else console.error('❌ Submissions API error:', subRes.reason?.response?.data || subRes.reason?.message);
      if (classRes.status === 'fulfilled') { classList = Array.isArray(classRes.value.data) ? classRes.value.data : []; console.log('✅ Classes:', classList.length); }
      else console.error('❌ Classes API error:', classRes.reason?.response?.data || classRes.reason?.message);

      const submitted = subList.filter(s => s.status === 'submitted').length;
      const pending   = subList.filter(s => s.status !== 'submitted').length;

      const s = {
        attendance:   attData.attendancePercentage || 0,
        streak:       attData.currentStreak        || 0,
        total:        attData.total                || 0,   // attendance days (present+absent)
        totalClasses: classList.length,                     // actual number of class videos uploaded
        present:      attData.present              || 0,
        absent:       attData.absent               || 0,
        submitted, pending,
      };
      setStats(s);

      const earned = [];
      if (s.totalClasses >= 1)       earned.push('first_class');
      if (s.streak  >= 7)            earned.push('week_streak');
      if (s.attendance === 100)      earned.push('perfect_month');
      if (submitted  >= 5)           earned.push('assignment_ace');
      if (s.attendance >= 80)        earned.push('early_bird');
      if (s.streak  >= 30)           earned.push('consistent');
      setEarnedBadges(earned);

      const activity = [];
      const lastSub = subList.find(s2 => s2.status === 'submitted');
      if (lastSub) {
        activity.push({ icon: '✅', text: `Assignment submitted (${lastSub.date})`, time: new Date(lastSub.submittedAt || lastSub.date), color: '#7c6af5' });
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const todayClass = classList.find(c => (c.date || '').split('T')[0] === todayStr);
      if (todayClass) {
        activity.push({ icon: '🎥', text: `New class available: ${todayClass.title || "Today's Session"}`, time: new Date(todayClass.createdAt || todayClass.date), color: '#00d4aa' });
      }
      if (s.streak > 0) {
        activity.push({ icon: '🔥', text: `${s.streak}-day attendance streak active!`, time: new Date(), color: '#f5a623' });
      }
      const pendingList = subList.filter(s2 => s2.status !== 'submitted');
      if (pendingList.length > 0) {
        activity.push({ icon: '📝', text: `${pendingList.length} assignment(s) pending — complete them now!`, time: new Date(), color: '#f55' });
      }
      activity.sort((a, b) => new Date(b.time) - new Date(a.time));
      setRecentActivity(activity);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const saveParentDetails = async () => {
    try {
      setSavingParent(true);
      const tok = token || localStorage.getItem('lms_token_student') || localStorage.getItem('token');
      await api.put(`${API}/api/auth/update`, { parentName, parentPhone }, { headers: { Authorization: `Bearer ${tok}` } });
      setParentSaved(true);
      setTimeout(() => setParentSaved(false), 2500);
    } catch (e) { alert('Failed to save'); } finally { setSavingParent(false); }
  };
  const attPercent = Math.round(stats.attendance);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: theme.pageBg }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden', background: theme.pageBg, color: theme.textPrimary, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <PageHeader />
      <Sidebar activePath="/profile" courseId={user&&user.enrolledCourse} />

      <main style={{ flex: 1, minWidth: 0, overflow: "hidden", marginLeft: isMobile ? 0 : 240, padding: isMobile ? '16px 14px 80px' : '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hero */}
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 20, padding: isMobile ? '18px 16px' : '28px', position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(circle at 20% 50%, ${theme.accent}0a 0%, transparent 60%)`, pointerEvents: 'none' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
            <div style={{ width: isMobile ? 56 : 80, height: isMobile ? 56 : 80, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4aa, #7c6af5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 22 : 32, fontWeight: 800, position: 'relative', flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid ${theme.accent}44` }}></div>
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 4 }}>{user?.name || 'Student'}</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 10 }}>{user?.email || ''}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: theme.accentPurple + '22', color: theme.accentPurple, border: `1px solid ${theme.accentPurple}44` }}>
                  {user?.role === 'teacher' ? '👨‍🏫 Teacher' : '💻 MERN Stack Developer'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: theme.accent + '22', color: theme.accent, border: `1px solid ${theme.accent}44` }}>
                  {earnedBadges.length} Badges Earned
                </span>
              </div>
            </div>
          </div>
          <button style={{ background: 'transparent', border: '1px solid #f5555544', color: '#f55', fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', position: 'relative', zIndex: 1, flexShrink: 0, whiteSpace: 'nowrap' }} onClick={handleLogout}>{isMobile ? '⏻' : '⏻ Logout'}</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', flexShrink: 0 }}>
          {['overview', 'parent', 'badges', 'activity'].map(tab => (
            <button key={tab}
              style={{ padding: isMobile ? '8px 14px' : '8px 20px', borderRadius: 8, border: 'none', background: activeTab === tab ? theme.hoverBg : 'transparent', color: activeTab === tab ? theme.textPrimary : theme.textMuted, fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Attendance',    value: `${attPercent}%`,     icon: '📅', color: theme.accent },
                { label: 'Total Classes', value: stats.totalClasses,    icon: '🎥', color: theme.accentPurple },
                { label: 'Streak',        value: `${stats.streak} 🔥`, icon: '⚡', color: theme.accentOrange },
                { label: 'Submitted',     value: stats.submitted,       icon: '✅', color: '#f56aa0' },
              ].map((s, i) => (
                <div key={i} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📊 Attendance Progress</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden", height: 8, background: theme.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, transition: 'width 1s ease', width: `${attPercent}%`, background: attPercent >= 75 ? theme.accent : attPercent >= 50 ? '#f5a623' : '#f55' }}></div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary, width: 40, textAlign: 'right' }}>{attPercent}%</span>
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary }}>
                {attPercent >= 75 ? '✅ Great attendance! Keep it up.' : attPercent >= 50 ? '⚠️ Needs improvement — try to attend more.' : '❌ Critical — please attend more classes.'}
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <span style={{ fontSize: 12, color: theme.accent }}>✓ Present: {stats.present} days</span>
                <span style={{ fontSize: 12, color: '#f55' }}>✗ Absent: {stats.absent} days</span>
                <span style={{ fontSize: 12, color: theme.textMuted }}>Total: {stats.total} days</span>
              </div>
            </div>

            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>👤 Account Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Full Name',    value: user?.name    || 'N/A' },
                  { label: 'Email',        value: user?.email   || 'N/A' },
                  { label: 'Role',         value: user?.role === 'teacher' ? 'Teacher' : 'MERN Stack Developer' },
                  { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A' },
                  { label: 'Course',       value: 'MERN Stack Development' },
                  { label: 'Institute',    value: 'Training Institute' },
                ].map((item, i) => (
                  <div key={i} style={{ background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: theme.textSecondary, fontWeight: 500 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Parent Details */}
        {activeTab === 'parent' && (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.textSecondary }}>👨‍👩‍👦 Parent / Guardian Details</div>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>
              These details are used by admin to send attendance notifications and weekly performance reports to your parents via WhatsApp.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent / Guardian Name</label>
                <input
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${theme.border}`, background: theme.pageBg, color: theme.textPrimary, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent WhatsApp Number</label>
                <input
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${theme.border}`, background: theme.pageBg, color: theme.textPrimary, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <button
              onClick={saveParentDetails}
              disabled={savingParent}
              style={{ alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 10, border: 'none', background: theme.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {savingParent ? '⏳ Saving...' : parentSaved ? '✅ Saved!' : '💾 Save Details'}
            </button>
            {parentName && parentPhone && (
              <div style={{ background: '#f0fdf4', border: '1px solid #10b981', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#065f46' }}>
                ✅ Parent details saved — admin will send attendance & weekly reports to <strong>{parentPhone}</strong>
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        {activeTab === 'badges' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
            {BADGES.map(badge => {
              const earned = earnedBadges.includes(badge.id);
              return (
                <div key={badge.id} style={{ background: theme.cardBg, border: `1px solid ${earned ? badge.color + '44' : theme.border}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', opacity: earned ? 1 : 0.35 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: earned ? badge.color + '22' : theme.border, color: earned ? badge.color : theme.textMuted }}>
                    {badge.icon}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>{badge.label}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.4 }}>{badge.desc}</div>
                  {earned
                    ? <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: `1px solid ${badge.color + '44'}`, color: badge.color, background: badge.color + '11' }}>✓ Earned</div>
                    : <div style={{ fontSize: 11, color: theme.textMuted, padding: '3px 10px' }}>🔒 Locked</div>
                  }
                </div>
              );
            })}
          </div>
        )}

        {/* Activity */}
        {activeTab === 'activity' && (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>📋 Recent Activity</div>
            {recentActivity.length === 0 ? (
              <p style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No activity yet. Attend classes and submit assignments to see your progress!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentActivity.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, background: item.color }}>{item.icon}</div>
                    <div style={{ flex: 1 , minWidth: 0, overflow: "hidden"}}>
                      <div style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 500 }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {new Date(item.time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ProfilePage;