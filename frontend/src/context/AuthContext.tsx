import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  store_name: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, storeName: string) => Promise<void>;
  demoLogin: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USER: User = {
  id: 'DEMO',
  name: 'Demo Kullanıcı',
  email: 'demo@basiret.ai',
  store_name: 'TechStore TR',
  token: 'demo-token',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('basiret_user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const u = res.data.user;
    setUser(u);
    localStorage.setItem('basiret_user', JSON.stringify(u));
    localStorage.setItem('basiret_token', u.token);
  };

  const register = async (name: string, email: string, password: string, storeName: string) => {
    const res = await api.post('/auth/register', { name, email, password, store_name: storeName });
    const u = res.data.user;
    setUser(u);
    localStorage.setItem('basiret_user', JSON.stringify(u));
    localStorage.setItem('basiret_token', u.token);
  };

  const demoLogin = () => {
    setUser(DEMO_USER);
    localStorage.setItem('basiret_user', JSON.stringify(DEMO_USER));
    localStorage.setItem('basiret_token', DEMO_USER.token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('basiret_user');
    localStorage.removeItem('basiret_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, demoLogin, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
