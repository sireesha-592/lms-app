import Sidebar from '../components/Sidebar';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const API = 'https://codemedha-production-47c1.up.railway.app';
const WeeklyReportPage = () => {
  const { user, token } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const printRef = useRef();
  const [report, setReport]   = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const tok = token || localStorage.getItem('lms_token_student') || localStorage.getItem('token');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`${API}/api/weekly-report`, { headers: { Authorization: `Bearer ${tok}` } });
      setReport(data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load report'); }
    finally { setLoading(false); }
  };

  const downloadPDF = () => {
    // Give browser a moment to apply print styles
    setTimeout(() => window.print(), 100);
  };

  const statusColor = s => ({ present:'#10b981', absent:'#ef4444', late:'#f59e0b' }[s] || '#9ca3af');
  const statusLabel = s => ({ present:'P', absent:'A', late:'L', no_class:'—' }[s] || '?');

  const C = {
    bg: isDark ? '#0f1117' : '#f8fafc', card: isDark ? '#1a1d27' : '#fff',
    border: isDark ? '#2a2d3a' : '#e2e8f0', text: isDark ? '#f1f5f9' : '#1e293b',
    muted: isDark ? '#94a3b8' : '#64748b', sidebar: '#1e293b',
  };

  const NAV = [
    { icon:'⊞', label:'Dashboard',    path:'/dashboard' },
    { icon:'📅', label:'Attendance',   path:'/attendance' },
    { icon:'🎥', label:'Classes',      path:'/courses' },
    { icon:'📚', label:'My Course',    path:'/my-course' },
    { icon:'📝', label:'Assignments',  path:'/assignments' },
    { icon:'📊', label:'Analytics',    path:'/analytics' },
    { icon:'📈', label:'Weekly Report',path:'/weekly-report', active:true },
    { icon:'🏆', label:'Leaderboard',  path:'/leaderboard' },
    { icon:'👤', label:'Profile',      path:'/profile' },
  ];

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:C.bg,color:C.muted,flexDirection:'column',gap:12}}>
      <div style={{fontSize:32}}>📊</div>
      <div style={{fontSize:14}}>Loading your weekly report...</div>
    </div>
  );

  const att  = report?.attendance || {};
  const asgn = report?.assignments || {};
  const trend = report?.trend || [];
  const pct  = att.percentage || 0;
  const pctColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {/* Sidebar */}
      <Sidebar activePath="/weekly-report" courseId={user&&user.enrolledCourse} />
      {/* Main */}
      <main style={{flex: 1, minWidth: 0, padding: isMobile ? '60px 12px 80px' : '32px', overflowY:'auto', overflowX:'hidden', boxSizing:'border-box'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:800,margin:0,color:C.text}}>📈 Weekly Performance Report</h2>
            {report?.period && <p style={{fontSize:13,color:C.muted,margin:'4px 0 0'}}>{report.period.from} → {report.period.to} · {user?.name}</p>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={fetchReport} style={{padding:'9px 18px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:13,fontWeight:600,cursor:'pointer'}}>🔄 Refresh</button>
            <button onClick={downloadPDF} style={{padding:'9px 20px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>⬇️ Download PDF</button>
          </div>
        </div>

        {error && <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:10,padding:'12px 16px',color:'#dc2626',fontSize:13,marginBottom:20}}>{error}</div>}

        {report && (
          <div ref={printRef} style={{display:'flex',flexDirection:'column',gap:20}}>
            {/* Print header (hidden on screen, visible on print) */}
            <div className="print-only" style={{display:'none',textAlign:'center',padding:'16px 0 8px',borderBottom:'2px solid #e2e8f0',marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:800}}>📈 Weekly Performance Report</div>
              <div style={{fontSize:13,color:'#64748b',marginTop:4}}>{user?.name} | {report.period?.from} → {report.period?.to}</div>
            </div>

            {/* Summary Cards */}
            <div style={{display:'grid',gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',gap:14}}>
              {[
                {label:'Attendance',  value:`${pct}%`,           icon:'📅',color:pctColor,  sub:`${att.present||0}P / ${att.absent||0}A`},
                {label:'Assignments', value:asgn.submitted||0,   icon:'✅',color:'#10b981', sub:`${asgn.pending||0} pending`},
                {label:'Total Score', value:asgn.totalScore||0,  icon:'🏆',color:'#6366f1', sub:'marks earned this week'},
                {label:'Last Week',   value:`${trend[trend.length-1]?.pct||0}%`, icon:'📊',color:'#f59e0b',sub:'attendance trend'},
              ].map((card,i) => (
                <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px',display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{fontSize:24}}>{card.icon}</div>
                  <div style={{fontSize:28,fontWeight:800,color:card.color}}>{card.value}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>{card.label}</div>
                  <div style={{fontSize:11,color:C.muted}}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Daily Attendance */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
              <div style={{fontSize:14,fontWeight:700,color:C.muted,marginBottom:16}}>📅 Daily Attendance — This Week</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:isMobile ? 4 : 10}}>
                {(att.days||[]).map((day,i) => (
                  <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted}}>{day.day}</div>
                    <div style={{width:44,height:44,borderRadius:'50%',background:statusColor(day.status)+'22',border:`2px solid ${statusColor(day.status)}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:statusColor(day.status)}}>
                      {statusLabel(day.status)}
                    </div>
                    <div style={{fontSize:10,color:C.muted}}>{day.date?.slice(5)}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:20,marginTop:16,flexWrap:'wrap'}}>
                {[['P','#10b981','Present'],['A','#ef4444','Absent'],['L','#f59e0b','Late'],['—','#9ca3af','No Class']].map(([l,c,label]) => (
                  <div key={l} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted}}>
                    <div style={{width:16,height:16,borderRadius:'50%',background:c+'33',border:`2px solid ${c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:c}}>{l}</div>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Progress */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
              <div style={{fontSize:14,fontWeight:700,color:C.muted,marginBottom:12}}>📊 Weekly Attendance Rate</div>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{flex: 1, minWidth: 0, overflow: "hidden",height:14,background:C.border,borderRadius:7,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,borderRadius:7,background:`linear-gradient(90deg,${pctColor},${pctColor}bb)`,transition:'width 0.8s ease'}}/>
                </div>
                <span style={{fontSize:20,fontWeight:800,color:pctColor,minWidth:54}}>{pct}%</span>
              </div>
              <div style={{fontSize:12,color:C.muted}}>
                {pct>=75?'✅ Excellent attendance! Keep it up.':pct>=50?'⚠️ Needs improvement — try to attend more.':'❌ Critical — please attend more classes.'}
              </div>
            </div>

            {/* 4-Week Trend Chart */}
            {trend.length>0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
                <div style={{fontSize:14,fontWeight:700,color:C.muted,marginBottom:16}}>📈 4-Week Attendance Trend</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:16,height:130,paddingBottom:4}}>
                  {trend.map((w,i) => {
                    const h  = Math.max(10,(w.pct/100)*100);
                    const cl = w.pct>=75?'#10b981':w.pct>=50?'#f59e0b':'#ef4444';
                    return (
                      <div key={i} style={{flex: 1, minWidth: 0, overflow: "hidden",display:'flex',flexDirection:'column',alignItems:'center',gap:5,height:'100%',justifyContent:'flex-end'}}>
                        <div style={{fontSize:12,fontWeight:700,color:cl}}>{w.pct}%</div>
                        <div style={{width:'100%',maxWidth:52,borderRadius:'6px 6px 0 0',background:`linear-gradient(180deg,${cl},${cl}99)`,height:`${h}%`,minHeight:10,transition:'height 0.6s ease'}}/>
                        <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{w.week}</div>
                        <div style={{fontSize:10,color:C.muted}}>{w.present}/{w.total}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Print footer */}
            <div className="print-only" style={{display:'none',textAlign:'center',fontSize:11,color:'#888',marginTop:20,paddingTop:12,borderTop:'1px solid #e2e8f0'}}>
              Generated by CodeMedha · {new Date().toLocaleDateString()} · {user?.name} ({user?.email})
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media print {
          /* Hide sidebar and header buttons */
          aside,
          .no-print { display: none !important; }

          /* Show print-only elements */
          .print-only { display: block !important; }

          /* Reset layout so main fills full page */
          body, html { margin: 0; padding: 0; background: #fff !important; }
          #root { display: block !important; }
          #root > div { display: block !important; }

          /* Main content area */
          main {
            display: block !important;
            padding: 20px !important;
            width: 100% !important;
            overflow: visible !important;
          }

          /* Header action buttons (Refresh / Download PDF) */
          main > div:first-child button { display: none !important; }

          /* Cards and content */
          div { break-inside: avoid; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
export default WeeklyReportPage;