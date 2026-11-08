import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agendia_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('agendia_token')) {
      localStorage.removeItem('agendia_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const errorMsg = (err) =>
  err?.response?.data?.error || (err?.request && !err.response ? 'No se pudo conectar con el servidor' : 'Ocurrió un error');

export default api;
