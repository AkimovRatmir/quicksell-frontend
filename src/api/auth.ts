import { apiClient, SKIP_AUTH_REDIRECT_HEADER } from './client';
import type {
  AuthResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  ResetTokenCheck,
  User,
} from '../types/api';

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', payload).then((r) => r.data),

  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

  /** Текущий пользователь вместе с тарифным планом — источник правды для free/pro. */
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),

  /**
   * Письмо со ссылкой на смену пароля. Ответ одинаков для любой почты —
   * показываем его как есть и никогда не сообщаем, есть ли такой аккаунт.
   */
  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', payload).then((r) => r.data),

  /**
   * Проверка ссылки из письма до показа формы — чтобы не давать вводить
   * пароль впустую. 401 тут про протухший токен из письма, а не про сессию,
   * поэтому глобальный разлогин пропускаем.
   */
  checkResetToken: (token: string) =>
    apiClient
      .get<ResetTokenCheck>('/auth/reset-password', {
        params: { token },
        headers: { [SKIP_AUTH_REDIRECT_HEADER]: '1' },
      })
      .then((r) => r.data),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient
      .post<{ message?: string }>('/auth/reset-password', payload, {
        headers: { [SKIP_AUTH_REDIRECT_HEADER]: '1' },
      })
      .then((r) => r.data),
};
