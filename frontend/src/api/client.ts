import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('basiret_token');
  if (token) {
    config.params = { ...config.params, token };
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('basiret_token');
      localStorage.removeItem('basiret_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
