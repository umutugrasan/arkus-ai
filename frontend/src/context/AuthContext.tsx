import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { tokenStorage } from '../api/client';
import { authService } from '../services';
import type { AuthUser } from '../types/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, store_name?: string) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sayfa yenilemesinde token varsa kullanici bilgisini cek
  useEffect(() => {
    const access = tokenStorage.getAccess();
    const cached = tokenStorage.getUser<AuthUser>();
    if (!access) {
      setIsLoading(false);
      return;
    }
    if (cached) setUser(cached);
    authService
      .me()
      .then((u) => {
        setUser(u);
        tokenStorage.setUser(u);
      })
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await authService.login(email, password);
    const { access_token, refresh_token, ...userData } = r.user;
    if (access_token) tokenStorage.setTokens(access_token, refresh_token);
    tokenStorage.setUser(userData);
    setUser(userData as AuthUser);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, store_name = '') => {
    const r = await authService.register(name, email, password, store_name);
    const { access_token, refresh_token, ...userData } = r.user;
    if (access_token) tokenStorage.setTokens(access_token, refresh_token);
    tokenStorage.setUser(userData);
    setUser(userData as AuthUser);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const u = await authService.me();
      setUser(u);
      tokenStorage.setUser(u);
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
