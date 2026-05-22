import axios from 'axios';

export const API_BASE = 'https://codemedha-production-47c1.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  // Use role-specific token based on current URL — prevents cross-role token pollution
  const path = window.location.hash || window.location.pathname;
  let token;
  if (path.includes('/admin')) {
    token = localStorage.getItem('lms_token_admin') || localStorage.getItem('token');
  } else if (path.includes('/trainer')) {
    token = localStorage.getItem('lms_token_trainer') || localStorage.getItem('token');
  } else {
    token = localStorage.getItem('lms_token_student') || localStorage.getItem('token');
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;