import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

import { API_BASE } from '../api';
const API = API_BASE;
const TABS = ['html','css','javascript','react'];
const TAB_META = {
  html:       { label: 'HTML',        icon: '🌐', color: '#e44d26' },
  css:        { label: 'CSS',         icon: '🎨', color: '#264de4' },
  javascript: { label: 'JavaScript',  icon: '⚡', color: '#f7df1e' },
  react:      { label: 'React (JSX)', icon: '⚛️', color: '#61dafb' },
};
const STARTER = {
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Answer</title>\n</head>\n<body>\n\n  <!-- Write your HTML here -->\n\n</body>\n</html>`,
  css:  `/* Write your CSS here */\n\nbody {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n`,
  javascript: `// Write your JavaScript here\n\nconsole.log('Hello!');\n`,
  react: `// Write your React component here\nimport React, { useState } from 'react';\n\nfunction Answer() {\n  return (\n    <div>\n      <h1>My Answer</h1>\n    </div>\n  );\n}\n\nexport default Answer;\n`,
};

function highlight(code, lang) {
  if (!code) return '';
  let s = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'html') {
    s = s
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
      .replace(/(&lt;\/?)([\w-]+)/g, '<span style="color:#e06c75">$1$2</span>')
      .replace(/([\w-]+=)("(?:[^"]*)")/g, '<span style="color:#d19a66">$1</span><span style="color:#98c379">$2</span>');
  } else if (lang === 'css') {
    s = s
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
      .replace(/([.#]?[\w-]+)(\s*\{)/g, '<span style="color:#e06c75">$1</span>$2')
      .replace(/([\w-]+)(\s*:)([^;{}]+)/g, '<span style="color:#56b6c2">$1</span>$2<span style="color:#98c379">$3</span>');
  } else {
    const kw = /\b(const|let|var|function|return|if|else|for|while|import|export|default|class|extends|new|this|async|await|try|catch|throw|typeof|instanceof|null|undefined|true|false|from|of|in|switch|case|break|continue)\b/g;
    s = s
      .replace(/(\/\/[^\n]*)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
      .replace(/(`(?:[^`\\]|\\.)*`)/g, '<span style="color:#98c379">$1</span>')
      .replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#98c379">$1</span>')
      .replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#98c379">$1</span>')
      .replace(kw, '<span style="color:#c678dd">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#d19a66">$1</span>');
  }
  return s;
}

export default function CodeEditor({ question, courseId, date, token, theme, submitted }) {
  const [activeTab,  setActiveTab]  = useState('html');
  const [code,       setCode]       = useState({ html: STARTER.html, css: STARTER.css, javascript: STARTER.javascript, react: STARTER.react });
  const [files,      setFiles]      = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSubmit, setCodeSubmit] = useState(null);
  const [showPreview,setShowPreview]= useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [uploading,  setUploading]  = useState(false);

  const fileRef     = useRef(null);
  const saveTimer   = useRef(null);
  const textareaRef = useRef(null);
  const preRef      = useRef(null);

  const questionId  = question?._id;
  const headers     = useRef({ Authorization: `Bearer ${token}` });
  useEffect(() => { headers.current = { Authorization: `Bearer ${token}` }; }, [token]);

  // Load existing answer
  useEffect(() => {
    if (!questionId || !date || !token) return;
    axios.get(`${API}/api/code-answers/${questionId}/${date}`, { headers: headers.current })
      .then(res => {
        if (res.data) {
          setCode(prev => ({ ...prev, ...res.data.code }));
          setActiveTab(res.data.activeTab || 'html');
          setFiles(res.data.files || []);
          setCodeSubmit(res.data);
        }
      })
      .catch(() => {});
  }, [questionId, date, token]);

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop  = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const doSave = useCallback(async (codeData, tab) => {
    if (!questionId || !date || !token) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/code-answers/save`,
        { questionId, courseId, date, code: codeData, activeTab: tab },
        { headers: headers.current }
      );
      setCodeSubmit(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    setSaving(false);
  }, [questionId, courseId, date, token]);

  const handleChange = (val) => {
    if (codeSubmit?.status === 'submitted' || submitted) return;
    const updated = { ...code, [activeTab]: val };
    setCode(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(updated, activeTab), 1500);
  };

  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const cur   = code[activeTab] || '';
    const next  = cur.substring(0, start) + '  ' + cur.substring(end);
    handleChange(next);
    setTimeout(() => {
      if (el) { el.selectionStart = el.selectionEnd = start + 2; }
    }, 0);
  };

  const uploadFile = async (file) => {
    if (!file || !questionId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('questionId', questionId);
      fd.append('courseId', courseId || '');
      fd.append('date', date);
      const res = await axios.post(`${API}/api/code-answers/upload-file`, fd, {
        headers: { ...headers.current, 'Content-Type': 'multipart/form-data' }
      });
      setFiles(res.data.answer?.files || []);
    } catch (e) { alert(e.response?.data?.message || 'Upload failed'); }
    setUploading(false);
  };

  const deleteFile = async (filename) => {
    try {
      await axios.delete(`${API}/api/code-answers/delete-file`, {
        data: { questionId, date, filename }, headers: headers.current
      });
      setFiles(prev => prev.filter(f => f.filename !== filename));
    } catch { /* silent */ }
  };

  const handleSubmitCode = async () => {
    if (!window.confirm('Submit this code answer? Cannot edit after submitting.')) return;
    setSubmitting(true);
    try {
      await doSave(code, activeTab);
      const res = await axios.post(`${API}/api/code-answers/submit`,
        { questionId, date },
        { headers: headers.current }
      );
      setCodeSubmit(res.data);
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const previewHTML = () =>
    `<!DOCTYPE html><html><head><style>${code.css}</style></head><body>${code.html}<script>${code.javascript}<\/script></body></html>`;

  const isSubmitted  = codeSubmit?.status === 'submitted' || submitted;
  const currentCode  = code[activeTab] || '';
  const highlighted  = highlight(currentCode, activeTab);

  const monoStyle = {
    position: 'absolute', inset: 0,
    padding: '14px 16px',
    fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace",
    fontSize: 13, lineHeight: '1.65',
    tabSize: 2, whiteSpace: 'pre',
    overflowWrap: 'normal',
    overflow: 'auto',
    margin: 0,
  };

  return (
    <div style={{ border: '1.5px solid #2a2a45', borderRadius: 12, overflow: 'hidden', background: '#1e1e2e' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#181825', borderBottom:'1px solid #2a2a45' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:13, color:'#cdd6f4', fontWeight:700 }}>💻 Code Editor</span>
          {isSubmitted && (
            <span style={{ fontSize:11, background:'#1D9E7520', color:'#1D9E75', border:'1px solid #1D9E7540', borderRadius:20, padding:'2px 10px', fontWeight:700 }}>
              ✅ Submitted
            </span>
          )}
          {saving   && <span style={{ fontSize:11, color:'#888' }}>Saving…</span>}
          {saved && !saving && <span style={{ fontSize:11, color:'#1D9E75', fontWeight:600 }}>✓ Saved</span>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowPreview(p => !p)}
            style={{ padding:'5px 14px', borderRadius:8, border:'none', background:showPreview?'#7c6af5':'#2a2a45', color:'#cdd6f4', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            {showPreview ? '✏️ Editor' : '👁️ Preview'}
          </button>
          {!isSubmitted && (
            <button onClick={handleSubmitCode} disabled={submitting || !questionId}
              style={{ padding:'5px 14px', borderRadius:8, border:'none', background:submitting?'#444':'linear-gradient(135deg,#00d4aa,#7c6af5)', color:'#fff', fontSize:12, cursor:submitting?'not-allowed':'pointer', fontWeight:700 }}>
              {submitting ? '⏳ Submitting…' : '🚀 Submit Code'}
            </button>
          )}
        </div>
      </div>

      {/* ── Language tabs ── */}
      <div style={{ display:'flex', background:'#11111b', borderBottom:'1px solid #2a2a45' }}>
        {TABS.map(tab => {
          const m = TAB_META[tab];
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex:1, padding:'9px 0', border:'none', background:active?'#1e1e2e':'transparent', color:active?m.color:'#555', fontSize:12, fontWeight:active?700:400, cursor:'pointer', borderBottom:active?`2.5px solid ${m.color}`:'2.5px solid transparent', transition:'all 0.15s' }}>
              {m.icon} {m.label}
            </button>
          );
        })}
      </div>

      {/* ── Editor + Preview ── */}
      <div style={{ display:'flex', height:320 }}>

        {/* Syntax-highlighted editor */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {/* Highlight layer (behind) */}
          <pre ref={preRef} aria-hidden="true"
            style={{ ...monoStyle, background:'#1e1e2e', color:'#abb2bf', pointerEvents:'none', userSelect:'none', zIndex:1, border:'none' }}
            dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          />
          {/* Actual textarea (transparent, on top) */}
          <textarea
            ref={textareaRef}
            value={currentCode}
            onChange={e => handleChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleTabKey}
            readOnly={isSubmitted}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder={`// Write your ${TAB_META[activeTab].label} here…`}
            style={{ ...monoStyle, background:'transparent', color:'transparent', caretColor:'#cdd6f4', border:'none', outline:'none', resize:'none', zIndex:2, opacity: isSubmitted ? 0.6 : 1, cursor: isSubmitted ? 'not-allowed' : 'text' }}
          />
        </div>

        {/* Live preview */}
        {showPreview && (
          <div style={{ flex:1, borderLeft:'1px solid #2a2a45', background:'#fff' }}>
            <iframe srcDoc={previewHTML()} sandbox="allow-scripts" style={{ width:'100%', height:'100%', border:'none' }} title="preview" />
          </div>
        )}
      </div>

      {/* ── File Upload ── */}
      <div style={{ padding:'12px 16px', background:'#181825', borderTop:'1px solid #2a2a45' }}>
        <div style={{ fontSize:11, color:'#555', marginBottom:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>
          📎 Attach Files <span style={{ fontWeight:400, textTransform:'none', color:'#444' }}>(optional)</span>
        </div>

        {!isSubmitted && (
          <div
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver?'#7c6af5':'#2a2a45'}`, borderRadius:10, padding:'12px', textAlign:'center', cursor:'pointer', background:dragOver?'#7c6af510':'transparent', transition:'all 0.2s', marginBottom:files.length?10:0 }}>
            <div style={{ fontSize:20, marginBottom:2 }}>{uploading?'⏳':'📁'}</div>
            <div style={{ fontSize:12, color:'#666' }}>{uploading?'Uploading…':'Drag & drop or click to browse'}</div>
            <div style={{ fontSize:10, color:'#444', marginTop:2 }}>.html .css .js .jsx .ts .tsx .json .zip .png .jpg .svg — max 10MB</div>
            <input ref={fileRef} type="file" style={{ display:'none' }}
              onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value=''; }} />
          </div>
        )}

        {files.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {files.map((f,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', background:'#1e1e2e', borderRadius:8, border:'1px solid #2a2a45' }}>
                <span>📄</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#cdd6f4', fontWeight:600 }}>{f.originalName}</div>
                  <div style={{ fontSize:10, color:'#555' }}>{(f.size/1024).toFixed(1)} KB</div>
                </div>
                <a href={`${API}/uploads/code-answers/${f.filename}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:11, color:'#7c6af5', textDecoration:'none', padding:'3px 8px', border:'1px solid #7c6af540', borderRadius:6 }}>View</a>
                {!isSubmitted && (
                  <button onClick={() => deleteFile(f.filename)}
                    style={{ background:'none', border:'none', color:'#f55', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}