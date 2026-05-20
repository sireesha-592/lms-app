// ─────────────────────────────────────────────────────────────────────────────
//  PATCH: Add this file as  frontend/src/api.js
//
//  WHY: In Electron, window.location is file:// so relative API calls fail.
//  This helper auto-detects the environment and points axios at the right URL.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';

// Detect if running inside Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';

// In Electron the backend runs on localhost:5000.
// In browser dev mode it's also localhost:5000 (via proxy).
// In production browser deployment set REACT_APP_API_URL in your .env.
export const API_BASE = isElectron
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000');

// Shared axios instance – import this instead of raw axios everywhere
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// ─────────────────────────────────────────────────────────────────────────────
//  HOW TO USE:
//
//  Replace:   import axios from 'axios';
//             const res = await axios.get('/api/courses');
//
//  With:      import api from '../api';
//             const res = await api.get('/api/courses');
//
//  That's the only change needed in every page/component file.
// ─────────────────────────────────────────────────────────────────────────────
