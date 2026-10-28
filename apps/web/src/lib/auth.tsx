import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@smart-campus/shared-types';
import { createApiClient, type ApiClient } from '@smart-campus/api-client';
import { apiBaseUrl } from './apiBaseUrl';

const ACCESS_KEY = 'sc_access';
const REFRESH_KEY = 'sc_refresh';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  api: ApiClient;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const tokenStore = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => createApiClient(apiBaseUrl, tokenStore), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    if (!tokenStore.getAccessToken()) {
      setUser(null);
      return;
    }
    const res = await api.me();
    setUser(res.data);
  }

  useEffect(() => {
    refreshProfile()
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    tokenStore.setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    setUser(res.data.user);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // ignore network logout errors
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, api, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
