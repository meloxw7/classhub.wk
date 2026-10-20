import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from './api';
import { User } from '../types';
type RegisterData = {
  name: string;
  email: string;
  password: string;
  role: string;
  username?: string;
  course?: string;
  semester?: string;
  ra?: string;
  institutionCode?: string;
  subjectName?: string;
};
type C = {
  user: User | null;
  login: (e: string, p: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
};
const AuthContext = createContext<C>({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('classhub_user') || 'null');
    } catch {
      return null;
    }
  });
  async function login(email: string, password: string, rememberMe = false) {
    const r = await api.post('/auth/login', { email, password, rememberMe });
    localStorage.setItem('classhub_token', r.data.token);
    localStorage.setItem('classhub_refresh', r.data.refreshToken);
    localStorage.setItem('classhub_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
  }
  async function register(data: RegisterData) {
    const r = await api.post('/auth/register', data);
    localStorage.setItem('classhub_token', r.data.token);
    localStorage.setItem('classhub_refresh', r.data.refreshToken);
    localStorage.setItem('classhub_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
  }
  async function logout() {
    const refreshToken = localStorage.getItem('classhub_refresh');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {}
    }
    localStorage.removeItem('classhub_token');
    localStorage.removeItem('classhub_refresh');
    localStorage.removeItem('classhub_user');
    setUser(null);
  }
  function updateUser(patch: Partial<User>) {
    setUser((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch };
      localStorage.setItem('classhub_user', JSON.stringify(next));
      return next;
    });
  }
  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
