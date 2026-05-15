import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// LocalStorage anahtarlari
const ACCESS_KEY = 'arkus_access_token';
const REFRESH_KEY = 'arkus_refresh_token';
const USER_KEY = 'arkus_user';

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  getUser<T = unknown>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setUser(user: unknown) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// Backend base URL — Vite proxy ile veya direct
const BASE_URL = 'https://backend-service-435783041080.europe-west3.run.app/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
});

// ----- Request interceptor: Authorization Bearer ekle -----
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccess();
  if (access && config.headers) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ----- Response interceptor: 401'de tek seferlik refresh dene -----
let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function notifyRefreshWaiters(token: string | null) {
  refreshWaiters.forEach((w) => w(token));
  refreshWaiters = [];
}

async function performRefresh(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    const resp = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
    const access = resp.data?.access_token;
    if (access) {
      tokenStorage.setTokens(access);
      return access;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (!original || !error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = original.url || '';
    // Refresh endpoint'inin kendisi 401 verirse bizimle alakali degil, logout'a duser
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');

    if (status !== 401 || original._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (isRefreshing) {
      // Baska bir istek halihazirda refresh ediyor: bekle
      return new Promise((resolve, reject) => {
        refreshWaiters.push((newToken) => {
          if (newToken) {
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
            resolve(api.request(original));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;
    const newAccess = await performRefresh();
    isRefreshing = false;
    notifyRefreshWaiters(newAccess);

    if (newAccess) {
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
      return api.request(original);
    }

    // Refresh fail → logout
    tokenStorage.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
