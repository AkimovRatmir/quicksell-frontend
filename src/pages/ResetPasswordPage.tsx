import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LogoMark, IconEye, IconEyeOff, IconShield } from '../components/Icons';

const MIN_PASSWORD = 8;

const STRENGTH_COLORS = ['#E24B4A', '#EF9F27', '#EF9F27', '#0F6E56'];
const STRENGTH_LABELS = ['Слабый', 'Средний', 'Хороший', 'Надёжный'];

function passwordScore(value: string) {
  let score = 0;
  if (value.length >= MIN_PASSWORD) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

/**
 * Смена пароля по ссылке из письма: /reset-password?token=…
 *
 * Токен проверяем до показа формы — иначе человек набирает пароль и только
 * потом узнаёт, что ссылка протухла. Если эндпоинт проверки недоступен,
 * форму всё равно показываем: последнее слово за POST.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const token = params.get('token') ?? '';

  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('Ссылка неполная — откройте её из письма целиком.');
      setChecking(false);
      return;
    }
    let cancelled = false;
    authApi
      .checkResetToken(token)
      .then((res) => {
        if (cancelled) return;
        // Явный valid:false — ссылка уже использована или просрочена
        if (res && res.valid === false) {
          setTokenError(res.message || 'Ссылка больше не действует. Запросите новую на странице входа.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 400/401/404 — про саму ссылку; прочее (500, нет сети) не мешает попробовать сменить пароль
        if (status === 400 || status === 401 || status === 404 || status === 410) {
          setTokenError(extractErrorMessage(err, 'Ссылка больше не действует. Запросите новую на странице входа.'));
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов`);
      return;
    }
    if (password !== repeat) {
      setError('Пароли не совпадают');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      // Старая сессия после смены пароля недействительна — чистим её сами,
      // чтобы не ловить 401 на первом же запросе под новым паролем.
      if (user) logout();
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сменить пароль'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const score = passwordScore(password);

  return (
    <div id="auth-screen">
      <div className="auth-left">
        <div className="auth-form-wrap">
          <div className="auth-card">
            <div className="auth-logo-sm">
              <LogoMark size={14} />
            </div>
            <div className="auth-title">Новый пароль</div>

            {checking ? (
              <div className="auth-sub">Проверяем ссылку…</div>
            ) : tokenError ? (
              <>
                <div className="auth-error">{tokenError}</div>
                <button className="auth-btn" type="button" onClick={() => navigate('/login', { replace: true })}>
                  Вернуться ко входу
                </button>
              </>
            ) : done ? (
              <>
                <div className="auth-note">Пароль изменён. Сейчас откроем страницу входа.</div>
                <button
                  className="auth-btn"
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  style={{ marginTop: 14 }}
                >
                  Войти
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="auth-sub" style={{ marginBottom: 16 }}>
                  Придумайте пароль не короче {MIN_PASSWORD} символов. Старый перестанет работать сразу.
                </div>

                {error && <div className="auth-error">{error}</div>}

                <div className="auth-field">
                  <label>Новый пароль</label>
                  <div className="pw-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`Минимум ${MIN_PASSWORD} символов`}
                      autoComplete="new-password"
                    />
                    <button className="pw-toggle" type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  <div className="sbars">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="sbar" style={{ background: i < score ? STRENGTH_COLORS[score - 1] : '#f0f0f0' }} />
                    ))}
                  </div>
                  {password && (
                    <div className="pw-hint" style={{ color: STRENGTH_COLORS[score - 1] ?? '#bbb' }}>
                      {STRENGTH_LABELS[score - 1] ?? ''}
                    </div>
                  )}
                </div>

                <div className="auth-field">
                  <label>Повторите пароль</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                    placeholder="Ещё раз"
                    autoComplete="new-password"
                  />
                </div>

                <button className="auth-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохраняем…' : 'Сохранить пароль'}
                </button>
                <button className="auth-back" type="button" onClick={() => navigate('/login', { replace: true })}>
                  ← Ко входу
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="ar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28, position: 'relative', zIndex: 1 }}>
            <LogoMark size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>QuickSell</span>
          </div>
          <div className="ar-pane active">
            <div className="ar-tagline">
              Ещё шаг — и вы <span>внутри</span>
            </div>
            <div className="ar-sub">Задайте новый пароль, и аналитика магазина снова у вас под рукой.</div>
            <div className="sec-note" style={{ marginTop: 'auto' }}>
              <div className="sn-title">
                <IconShield />
                Что произойдёт
              </div>
              <div className="sn-text">
                Ссылка сработает один раз. После смены пароля все открытые сессии — на других устройствах и в других
                браузерах — придётся авторизовать заново.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
