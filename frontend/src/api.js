import axios from 'axios';

export const API_BASE = 'https://codemedha-production-47c1.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
