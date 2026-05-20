import React, { useState } from 'react';
import api from '../api';
import { API_BASE as API } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login({ role = 'student' }) {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const configs = {
    trainer: { grad: 'linear-gradient(135deg,#1a472a,#2d6a4f)', accent: '#52b788', label: '🎓 Trainer Login' },
    admin:   { grad: 'linear-gradient(135deg,#4a1942,#7b2d8b)', accent: '#c77dff', label: '👑 Admin Login'   },
    student: { grad: 'linear-gradient(135deg,#1a1a2e,#0f3460)', accent: '#00d4aa', label: '👤 Student Login'  },
  };
  const c = configs[role] || configs.student;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res      = await api.post('/api/auth/login', form);
      const user     = res.data.user;
      const userRole = user.role || '';

      if (role === 'trainer' && userRole !== 'trainer' && userRole !== 'teacher') {
        setError('Please enter trainer credentials!'); setLoading(false); return;
      }
      if (role === 'admin' && userRole !== 'admin') {
        setError('Please enter admin credentials!'); setLoading(false); return;
      }
      if (role === 'student' && userRole !== 'student') {
        setError('Please enter student credentials!'); setLoading(false); return;
      }

      login(user, res.data.token);

      if (userRole === 'admin')                                navigate('/admin');
      else if (userRole === 'teacher' || userRole === 'trainer') navigate('/trainer');
      else                                                       navigate('/dashboard');

    } catch (err) {
      setError(err?.response?.data?.message || err?.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container(c.grad)}>
      <div style={styles.card}>
        <div style={{ ...styles.logo, background: c.accent }}>⚡</div>
        <h2 style={styles.title}>CodeMedha</h2>
        <p style={{ ...styles.sub, color: c.accent }}>{c.label}</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            style={styles.input}
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <button
            style={{ ...styles.button, background: c.accent, opacity: loading ? 0.7 : 1 }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <style>{`
        /* Android WebView: ensure no horizontal overflow on login screen */
        @media (max-width: 420px) {
          .login-card {
            padding: 24px 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  /* container uses a function to accept gradient arg */
  container: (grad) => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',          /* minHeight instead of height so it grows on small keyboards */
    padding: '16px',             /* prevents card touching screen edge */
    background: grad,
    boxSizing: 'border-box',
  }),
  card: {
    background: '#fff',
    padding: '2rem 1.75rem',
    borderRadius: '16px',
    width: '100%',               /* fills available width */
    maxWidth: '400px',           /* caps at 400px on large screens */
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    boxSizing: 'border-box',
  },
  logo:  { width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px', color: '#fff' },
  title: { color: '#1e3a5f', textAlign: 'center', fontSize: 22, fontWeight: 800, margin: 0 },
  sub:   { fontSize: 14, textAlign: 'center', marginBottom: '1.5rem', marginTop: 6, fontWeight: 700 },
  input: {
    width: '100%',
    padding: '12px 14px',
    margin: '7px 0',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
    fontSize: '16px',            /* 16px prevents iOS/Android zoom-on-focus */
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    display: 'block',
  },
  button: {
    width: '100%',
    padding: '13px',
    marginTop: '1rem',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '44px',           /* accessible tap target */
    display: 'block',
  },
  error: { color: '#e74c3c', fontSize: '13px', textAlign: 'center', background: '#fdecea', padding: '8px 12px', borderRadius: 8, marginBottom: 8 },
};
