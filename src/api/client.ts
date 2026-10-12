import axios from 'axios';
import { humanizeMessages, messageForStatus } from './errorText';

const TOKEN_KEY = 'kaspi_analytics_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type ApiClientErrorListener = () => void;
let unauthorizedListener: ApiClientErrorListener | null = null;

export function onUnauthorized(listener: ApiClientErrorListener) {
  unauthorizedListener = listener;
}

/**
 * Some endpoints (e.g. Kaspi seller connect/sync) return 401 for a Kaspi-side
 * auth problem (wrong Kaspi login/password, expired Kaspi session) — that has
 * nothing to do with our own JWT. Requests can opt out of the global
 * "log the user out" handling by sending this header.
 */
export const SKIP_AUTH_REDIRECT_HEADER = 'X-Skip-Auth-Redirect';

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const skip = error.config?.headers?.[SKIP_AUTH_REDIRECT_HEADER];
    if (error.response?.status === 401 && !skip) {
      unauthorizedListener?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Текст ошибки для показа пользователю. Русское сообщение бэкенда — как есть,
 * знакомое английское — переведённым, остальное — по статусу или запасной
 * текст экрана (см. errorText.ts). Сырые «Invalid credentials» и
 * «Network Error» наружу больше не попадают.
 */
export function extractErrorMessage(error: unknown, fallback = 'Что-то пошло не так'): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string | string[] } | undefined;
    if (body?.message) {
      const human = humanizeMessages(body.message);
      if (human) return human;
    }
    const byStatus = messageForStatus(error.response?.status);
    if (byStatus) return byStatus;
  }
  return fallback;
}
