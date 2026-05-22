import Sidebar from '../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';
const medal = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

const LeaderboardPage = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [data, setData]       = useState([]);
  const [myId, setMyId]       = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('score'); // 'score' | 'attendance' | 'composite'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`${API}/api/submissions/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data.leaderboard || []);
      setMyId(res.data.myId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (filter === 'attendance') return b.attPct - a.attPct || b.totalScore - a.totalScore;
    if (filter === 'composite')  return b.composite - a.composite;
    return b.totalScore - a.totalScore || b.attPct - a.attPct;
  });

  const myRank = sorted.findIndex(s => s.userId === myId) + 1;
  const me = sorted.find(s => s.userId === myId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden', background: theme.pageBg, color: theme.textPrimary, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <PageHeader />
      <Sidebar activePath="/leaderboard" courseId={user&&user.enrolledCourse} />

      <main style={{ flex: 1, marginLeft: isMobile ? 0 : 240, marginTop: 64, padding: isMobile ? '0 12px 80px' : '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, overflowX: 'hidden', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 4 }}>🏆 Leaderboard</div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Rankings based on assignment scores &amp; attendance</div>
          </div>
          <button onClick={fetchLeaderboard} style={{ background: theme.hoverBg, border: `1px solid ${theme.border}`, color: theme.textSecondary, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            🔄 Refresh
          </button>
        </div>

        {/* My rank card */}
        {me && (
          <div style={{ background: `linear-gradient(135deg, ${isDark ? '#1a2740' : '#1e3a5f'}, ${isDark ? '#12203a' : '#152d4d'})`, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, border: '1.5px solid #7c6af555' }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>{medal(myRank)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#a0b4c8', fontWeight: 600, marginBottom: 4 }}>YOUR RANK</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>#{myRank} <span style={{ fontSize: 16, fontWeight: 500, color: '#a0b4c8' }}>out of {sorted.length}</span></div>
              <div style={{ fontSize: 13, color: '#a0b4c8', marginTop: 4 }}>{me.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Total Score', value: me.totalScore, color: '#7c6af5' },
                { label: 'Submitted',   value: `${me.submitted} assignments`, color: '#00d4aa' },
                { label: 'Attendance',  value: `${me.attPct}%`, color: me.attPct >= 75 ? '#1D9E75' : '#f5a623' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#a0b4c8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'score',      label: '📝 By Score' },
            { key: 'attendance', label: '📅 By Attendance' },
            { key: 'composite',  label: '⭐ Overall' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${filter === f.key ? theme.accent : theme.border}`, background: filter === f.key ? theme.accent + '22' : theme.hoverBg, color: filter === f.key ? theme.accent : theme.textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr 80px 80px' : '60px 1fr 120px 120px 120px 100px', gap: 12, padding: '12px 20px', background: theme.pageBg, borderBottom: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>Rank</div>
            <div>Student</div>
            <div style={{ textAlign: 'center' }}>Total Score</div>
            <div style={{ textAlign: 'center' }}>Submitted</div>
            <div style={{ textAlign: 'center' }}>Attendance</div>
            <div style={{ textAlign: 'center' }}>Overall</div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: theme.textMuted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
              <p>No submissions yet. Be the first to submit an assignment!</p>
            </div>
          ) : (
            sorted.map((s, idx) => {
              const rank   = idx + 1;
              const isMe   = s.userId === myId;
              const isTop3 = rank <= 3;
              return (
                <div key={s.userId}
                  style={{ display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr 80px 80px' : '60px 1fr 120px 120px 120px 100px', gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: `1px solid ${theme.border}`, background: isMe ? (isDark ? '#7c6af515' : '#7c6af508') : 'transparent', transition: 'background 0.2s' }}>

                  {/* Rank */}
                  <div style={{ fontSize: isTop3 ? 22 : 15, fontWeight: 700, color: isTop3 ? undefined : theme.textMuted, textAlign: 'center' }}>
                    {isTop3 ? medal(rank) : `#${rank}`}
                  </div>

                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isTop3 ? 'linear-gradient(135deg,#00d4aa,#7c6af5)' : theme.hoverBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: isTop3 ? '#fff' : theme.textMuted, flexShrink: 0 }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                        {s.name} {isMe && <span style={{ fontSize: 11, background: '#7c6af522', color: '#7c6af5', padding: '2px 7px', borderRadius: 6, marginLeft: 6 }}>You</span>}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>MERN Stack Developer</div>
                    </div>
                  </div>

                  {/* Total Score */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>{s.totalScore}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{s.submitted > 0 ? `avg ${Math.round(s.totalScore / s.submitted)}/130` : '—'}</div>
                  </div>

                  {/* Submitted */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary }}>{s.submitted}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>assignments</div>
                  </div>

                  {/* Attendance */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.attPct >= 75 ? '#1D9E75' : s.attPct >= 50 ? '#f5a623' : '#f55' }}>{s.attPct}%</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{s.attPresent}/{s.attTotal} days</div>
                    <div style={{ height: 4, background: theme.border, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${s.attPct}%`, background: s.attPct >= 75 ? '#1D9E75' : '#f5a623', borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Composite */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#7c6af5' }}>{s.composite}%</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>overall</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>
          Overall score = 70% assignment score + 30% attendance • Updates in real-time
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LeaderboardPage;