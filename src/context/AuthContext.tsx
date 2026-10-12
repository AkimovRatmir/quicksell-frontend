import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import { onUnauthorized, tokenStorage } from '../api/client';
import type { LoginPayload, Plan, RegisterPayload, User } from '../types/api';

const USER_KEY = 'kaspi_analytics_user';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isReady: boolean;
  /** Тариф из GET /auth/me. До ответа считаем free, чтобы не показать платное лишнего. */
  plan: Plan;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [isReady, setIsReady] = useState(true);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  const applySession = (accessToken: string, sessionUser: User) => {
    tokenStorage.set(accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    setToken(accessToken);
    setUser(sessionUser);
  };

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    applySession(res.accessToken, res.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await authApi.register(payload);
    applySession(res.accessToken, res.user);
  }, []);

  /** Подтягивает актуальный профиль (в первую очередь — тариф) с бэкенда. */
  const refreshUser = useCallback(async () => {
    if (!tokenStorage.get()) return;
    const fresh = await authApi.me();
    localStorage.setItem(USER_KEY, JSON.stringify(fresh));
    setUser(fresh);
  }, []);

  // Ответ /auth/register и /auth/login может не содержать план, да и оплатить
  // тариф могли в другой вкладке — поэтому профиль всегда освежаем при старте.
  useEffect(() => {
    if (!token) return;
    refreshUser().catch(() => undefined);
  }, [token, refreshUser]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const plan: Plan = user?.plan === 'pro' ? 'pro' : 'free';

  const value = useMemo(
    () => ({
      user,
      token,
      isReady,
      plan,
      login,
      register,
      refreshUser,
      logout,
    }),
    [user, token, isReady, plan, login, register, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
