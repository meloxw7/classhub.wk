import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const apiBaseURL = baseURL;

export const api = axios.create({ baseURL, withCredentials: true });

export function fileUrl(path: string) {
  const base = baseURL.replace(/\/api\/?$/, '');
  return `${base}/api/files/${String(path).replace(/\\/g, '/')}`;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  try {
    await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
    return true;
  } catch {
    return false;
  }
}

export function refreshSession(): Promise<boolean> {
  refreshing = refreshing || tryRefresh();
  return refreshing.then((ok) => {
    refreshing = null;
    return ok;
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

type RetriableConfig = InternalAxiosRequestConfig & { retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config.retried) {
      config.retried = true;
      const ok = await refreshSession();
      if (ok) {
        return api.request(config);
      }
      localStorage.removeItem('classhub_user');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
