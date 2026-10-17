import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const apiBaseURL = baseURL;

export const api = axios.create({ baseURL });

export function fileUrl(path: string) {
  const base = baseURL.replace(/\/api\/?$/, '');
  return `${base}/${String(path).replace(/\\/g, '/')}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('classhub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('classhub_refresh');
  if (!refreshToken) return null;
  try {
    const r = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    localStorage.setItem('classhub_token', r.data.token);
    localStorage.setItem('classhub_refresh', r.data.refreshToken);
    return r.data.token as string;
  } catch {
    return null;
  }
}

export function refreshSession(): Promise<string | null> {
  refreshing = refreshing || tryRefresh();
  return refreshing.then((token) => {
    refreshing = null;
    return token;
  });
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const r = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearSession() {
  localStorage.removeItem('classhub_token');
  localStorage.removeItem('classhub_refresh');
  localStorage.removeItem('classhub_user');
}

type RetriableConfig = InternalAxiosRequestConfig & { retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config.retried) {
      config.retried = true;
      const token = await refreshSession();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
      clearSession();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
