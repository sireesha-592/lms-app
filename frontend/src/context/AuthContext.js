import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();
const API = 'https://codemedha-production-47c1.up.railway.app';

export const AuthProvider = ({ children }) => {

  const getKeys = (role) => {
    if (role === 'admin')                          return { u: 'lms_user_admin',   t: 'lms_token_admin'   };
    if (role === 'trainer' || role === 'teacher')  return { u: 'lms_user_trainer', t: 'lms_token_trainer' };
    return                                                { u: 'lms_user_student', t: 'lms_token_student' };
  };

  const getCurrentKeys = () => {
    const path = window.location.hash || window.location.pathname;
    if (path.includes('/admin'))   return { u: 'lms_user_admin',   t: 'lms_token_admin'   };
    if (path.includes('/trainer')) return { u: 'lms_user_trainer', t: 'lms_token_trainer' };
    return                                { u: 'lms_user_student', t: 'lms_token_student' };
  };

  const { u: USER_KEY, t: TOKEN_KEY } = getCurrentKeys();

  // ── FIX: isLoading prevents PrivateRoute from redirecting before auth is read ──
  const [isLoading, setIsLoading] = useState(true);

  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);

  // Auto-refresh on app load — sets isLoading=false when done
  useEffect(() => {
    const { u, t } = getCurrentKeys();
    const storedToken = localStorage.getItem(t);

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(freshUser => {
        if (!freshUser) return;
        setUser(freshUser);
        localStorage.setItem(u, JSON.stringify(freshUser));
        localStorage.setItem('user', JSON.stringify(freshUser));
      })
      .catch(() => {})
      .finally(() => {
        // ── CRITICAL: mark auth as ready regardless of network result ──
        setIsLoading(false);
      });
  }, []);

  // Tab/browser close lo sendBeacon tho logout record cheyyi
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionId    = localStorage.getItem('lms_session_id');
      const sessionToken = localStorage.getItem('lms_session_token');
      if (!sessionId || !sessionToken) return;
      const blob = new Blob(
        [JSON.stringify({ sessionId, token: sessionToken })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(`${API}/api/sessions/beacon-logout`, blob);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const login = async (userData, tokenData) => {
    const { u, t } = getKeys(userData.role);
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem(u, JSON.stringify(userData));
    localStorage.setItem(t, tokenData);
    localStorage.setItem('token', tokenData);
    localStorage.setItem('user',  JSON.stringify(userData));

    try {
      const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${tokenData}` } });
      if (res.ok) {
        const freshUser = await res.json();
        setUser(freshUser);
        localStorage.setItem(u, JSON.stringify(freshUser));
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
    } catch (e) {}

    // Trainer / Student login session record cheyyi (admin వద్దు)
    if (['trainer', 'teacher', 'student'].includes(userData.role)) {
      try {
        const sessRes = await fetch(`${API}/api/sessions/login`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenData}`, 'Content-Type': 'application/json' },
        });
        if (sessRes.ok) {
          const { sessionId } = await sessRes.json();
          localStorage.setItem('lms_session_id',    sessionId);
          localStorage.setItem('lms_session_token', tokenData);
        }
      } catch (e) {}
    }
  };

  const updateUser = (updatedFields) => {
    const { u } = getCurrentKeys();
    const updated = { ...JSON.parse(localStorage.getItem(u) || '{}'), ...updatedFields };
    setUser(updated);
    localStorage.setItem(u, JSON.stringify(updated));
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const logout = async () => {
    const sessionId    = localStorage.getItem('lms_session_id');
    const sessionToken = localStorage.getItem('lms_session_token');
    if (sessionId && sessionToken) {
      try {
        await fetch(`${API}/api/sessions/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (e) {}
      localStorage.removeItem('lms_session_id');
      localStorage.removeItem('lms_session_token');
    }

    const { u, t } = getCurrentKeys();
    setUser(null);
    setToken(null);
    localStorage.removeItem(u);
    localStorage.removeItem(t);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
