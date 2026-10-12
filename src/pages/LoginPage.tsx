import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveSetupDraft } from '../lib/setupDraft';
import { useLegalDocuments } from '../lib/useLegalDocuments';
import { authApi } from '../api/auth';
import { legalApi } from '../api/legal';
import { extractErrorMessage } from '../api/client';
import { LogoMark, IconEye, IconEyeOff, IconExternalLink, IconCheck, IconShield } from '../components/Icons';
import { ConsentCheck, RegistrationConsentText, SubscriptionConsentText } from '../components/LegalConsent';

type Screen = 'step1' | 'step2' | 'step3' | 'step4' | 'login' | 'forgot';

const STRENGTH_COLORS = ['#E24B4A', '#EF9F27', '#EF9F27', '#0F6E56'];
const STRENGTH_LABELS = ['Слабый', 'Средний', 'Хороший', 'Надёжный'];

function passwordScore(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { acceptedFor } = useLegalDocuments();

  const [screen, setScreen] = useState<Screen>('step1');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Шаг 1 — аккаунт QuickSell
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Согласия с документами. Стартуют снятыми: предотмеченная галочка —
  // не согласие. «Missing» — пытались продолжить без галочки, подсвечиваем.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsMissing, setTermsMissing] = useState(false);
  const [billingAccepted, setBillingAccepted] = useState(false);
  const [billingMissing, setBillingMissing] = useState(false);

  // Шаг 2 — магазин Kaspi: название + API токен
  const [storeName, setStoreName] = useState('');
  const [kaspiToken, setKaspiToken] = useState('');

  // Шаг 3 — отдельный пользователь Kaspi (не почта аккаунта QuickSell!)
  const [kaspiLogin, setKaspiLogin] = useState('');
  const [kaspiPassword, setKaspiPassword] = useState('');

  // Шаг 4 — тариф
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'full'>('free');

  // Какие шаги подключения пропустили — их поля подсветим в «Настройках»
  const [skippedToken, setSkippedToken] = useState(false);
  const [skippedAccess, setSkippedAccess] = useState(false);

  // Вход
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Восстановление пароля
  const [forgotEmail, setForgotEmail] = useState('');
  // Ответ бэкенда показываем как есть: он одинаков для любой почты и не
  // выдаёт, зарегистрирован ли такой адрес.
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 220);
  };

  const goStep = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  /**
   * Уводит в «Настройки» и передаёт, какие шаги подключения пропущены —
   * там эти поля подсвечиваются и висит баннер «Завершите подключение».
   */
  const goToSettings = (setupNeeded: { token: boolean; access: boolean }) =>
    navigate('/', { replace: true, state: { tab: 'settings', setupNeeded } });

  const handleStep1Next = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      triggerShake();
      return;
    }
    if (!termsAccepted) {
      setTermsMissing(true);
      triggerShake();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        acceptedTerms: true,
        acceptedDocuments: acceptedFor(['oferta', 'policy']),
      });
      goStep('step2');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось зарегистрироваться'));
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Next = (e: FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !kaspiToken.trim()) {
      triggerShake();
      return;
    }
    goStep('step3');
  };

  const handleStep3Next = (e: FormEvent) => {
    e.preventDefault();
    if (!kaspiLogin.trim() || !kaspiPassword.trim()) {
      triggerShake();
      return;
    }
    goStep('step4');
  };

  /**
   * Финал мастера. Магазин здесь больше не создаём: Kaspi требует код с почты,
   * и его вводят в «Настройках». Мастер только собирает данные — они
   * подставятся в форму подключения, чтобы не вводить всё второй раз.
   */
  const handleFinish = () => {
    // Платный тариф — отдельное согласие на оферту, процедуру оплаты и автосписание
    if (selectedPlan === 'full' && !billingAccepted) {
      setBillingMissing(true);
      triggerShake();
      return;
    }
    if (selectedPlan === 'full') {
      // Фиксируем согласие, но не держим из-за него мастер: списания здесь ещё
      // нет, а перед самой оплатой согласие запрашивается заново на «Тарифе».
      legalApi.acceptConsents('subscription').catch(() => undefined);
    }
    saveSetupDraft({
      storeName: skippedToken ? '' : storeName.trim(),
      kaspiToken: skippedToken ? '' : kaspiToken.trim(),
      kaspiLogin: skippedAccess ? '' : kaspiLogin.trim(),
      kaspiPassword: skippedAccess ? '' : kaspiPassword,
    });
    goToSettings({ token: skippedToken || !storeName.trim(), access: skippedAccess });
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      triggerShake();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: forgotEmail.trim() });
      setForgotMessage(res?.message || 'Если такой аккаунт есть, письмо со ссылкой уже отправлено.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось отправить письмо'));
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      triggerShake();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: loginEmail.trim(), password: loginPassword });
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось войти'));
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const score = passwordScore(password);
  const cardClass = `auth-card${shake ? ' auth-shake' : ''}`;

  return (
    <div id="auth-screen">
      {/* ЛЕВАЯ ПАНЕЛЬ: ФОРМЫ */}
      <div className="auth-left">
        <div className="auth-form-wrap">
          {screen === 'step1' && (
            <div className={cardClass}>
              <AuthLogo />
              <StepBars done={1} />
              <div className="astep-label">
                <b>Шаг 1 из 4</b>
              </div>
              <div className="auth-title">Создать аккаунт</div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleStep1Next}>
                <div className="auth-field">
                  <label>Имя</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Олег Черепошенко" autoComplete="name" />
                </div>
                <div className="auth-field">
                  <label>Электронная почта</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="oleg@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="auth-field">
                  <label>Пароль</label>
                  <div className="pw-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 8 символов"
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

                <div style={{ margin: '2px 0 10px' }}>
                  <ConsentCheck
                    id="reg-terms"
                    checked={termsAccepted}
                    invalid={termsMissing && !termsAccepted}
                    onChange={(v) => {
                      setTermsAccepted(v);
                      if (v) setTermsMissing(false);
                    }}
                  >
                    <RegistrationConsentText />
                  </ConsentCheck>
                </div>
                <button className="auth-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Подождите…' : 'Продолжить →'}
                </button>
                <div className="auth-switch">
                  Уже есть аккаунт? <a onClick={() => goStep('login')}>Войти</a>
                </div>
              </form>
            </div>
          )}

          {screen === 'step2' && (
            <div className={cardClass}>
              <AuthLogo />
              <StepBars done={2} />
              <div className="astep-label">
                <b>Шаг 2 из 4</b>
              </div>
              <div className="auth-title">Подключите Kaspi магазин</div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleStep2Next}>
                <div className="auth-field">
                  <label>Название магазина</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Demo Store KZ"
                    autoComplete="off"
                  />
                </div>
                <div className="auth-field">
                  <label>Kaspi API токен</label>
                  <input
                    type="text"
                    value={kaspiToken}
                    onChange={(e) => setKaspiToken(e.target.value)}
                    placeholder="Вставьте токен из кабинета Kaspi"
                    autoComplete="off"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                <button className="auth-btn purple" type="submit">
                  Подключить магазин →
                </button>
                {/* Пропуск помечает шаг и ведёт дальше — дозаполним в «Настройках» */}
                <span
                  className="skip-link"
                  onClick={() => {
                    setSkippedToken(true);
                    goStep('step3');
                  }}
                >
                  Пропустить, подключу позже
                </span>
                <button className="auth-back" type="button" onClick={() => goStep('step1')}>
                  ← Назад
                </button>
              </form>
            </div>
          )}

          {screen === 'step3' && (
            <div className={cardClass}>
              <AuthLogo />
              <StepBars done={3} />
              <div className="astep-label">
                <b>Шаг 3 из 4</b>
              </div>
              <div className="auth-title">Создайте пользователя QuickSell</div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleStep3Next}>
                <div className="auth-field">
                  <label>Логин пользователя</label>
                  <input
                    type="text"
                    value={kaspiLogin}
                    onChange={(e) => setKaspiLogin(e.target.value)}
                    placeholder="Логин из письма Kaspi"
                    autoComplete="off"
                  />
                </div>
                <div className="auth-field">
                  <label>Пароль пользователя</label>
                  <input
                    type="text"
                    value={kaspiPassword}
                    onChange={(e) => setKaspiPassword(e.target.value)}
                    placeholder="Пароль из письма Kaspi"
                    autoComplete="off"
                  />
                  <div className="auth-hint">
                    Создайте пользователя в кабинете Kaspi по инструкции на этой странице — логин и пароль придут на указанную почту.
                  </div>
                </div>

                <button className="auth-btn purple" type="submit">
                  Подключить доступ →
                </button>
                <span
                  className="skip-link"
                  onClick={() => {
                    setSkippedAccess(true);
                    goStep('step4');
                  }}
                >
                  Пропустить, настрою позже
                </span>
                <button className="auth-back" type="button" onClick={() => goStep('step2')}>
                  ← Назад
                </button>
              </form>
            </div>
          )}

          {screen === 'step4' && (
            <div className={cardClass}>
              <AuthLogo />
              <StepBars done={4} />
              <div className="astep-label">
                <b>Шаг 4 из 4</b>
              </div>
              <div className="auth-title">Выберите тариф</div>

              {error && <div className="auth-error">{error}</div>}

              <div className="plan-grid">
                <div className={`plan-opt${selectedPlan === 'free' ? ' selected' : ''}`} onClick={() => setSelectedPlan('free')}>
                  <div className="po-radio" />
                  <div className="po-head">
                    <span className="po-name">Free</span>
                    <span className="po-badge">Без срока</span>
                  </div>
                  <div className="po-price">
                    0 ₸<span className="per"> / навсегда</span>
                  </div>
                  <div className="po-desc">Базовая аналитика магазина без ограничений по времени. Без карты.</div>
                </div>
                <div className={`plan-opt${selectedPlan === 'full' ? ' selected' : ''}`} onClick={() => setSelectedPlan('full')}>
                  <div className="po-radio" />
                  <div className="po-head">
                    <span className="po-name">Полный доступ</span>
                  </div>
                  <div className="po-price">
                    15 000 ₸<span className="per"> / мес</span>
                  </div>
                  <div className="po-desc">Чистая прибыль, статистика по товарам, юнит-экономика и AI-рекомендации.</div>
                </div>
              </div>

              {selectedPlan === 'full' && (
                <div style={{ margin: '4px 0 10px' }}>
                  <ConsentCheck
                    id="reg-billing"
                    checked={billingAccepted}
                    invalid={billingMissing && !billingAccepted}
                    onChange={(v) => {
                      setBillingAccepted(v);
                      if (v) setBillingMissing(false);
                    }}
                  >
                    <SubscriptionConsentText />
                  </ConsentCheck>
                </div>
              )}
              <button className="auth-btn purple" onClick={handleFinish}>
                Начать работу →
              </button>
              <button className="auth-back" type="button" onClick={() => goStep('step3')}>
                ← Назад
              </button>
            </div>
          )}

          {screen === 'login' && (
            <div className={cardClass}>
              <AuthLogo />
              <div className="auth-title">Вход</div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleLoginSubmit}>
                <div className="auth-field">
                  <label>Электронная почта</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="oleg@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="auth-field">
                  <label>Пароль</label>
                  <div className="pw-wrap">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Ваш пароль"
                      autoComplete="current-password"
                    />
                    <button className="pw-toggle" type="button" tabIndex={-1} onClick={() => setShowLoginPassword((v) => !v)}>
                      {showLoginPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  <div className="auth-hint" style={{ textAlign: 'right' }}>
                    <a
                      onClick={() => {
                        setForgotMessage(null);
                        setForgotEmail(loginEmail);
                        goStep('forgot');
                      }}
                      style={{ color: '#7F77DD', textDecoration: 'none', cursor: 'pointer' }}
                    >
                      Забыли пароль?
                    </a>
                  </div>
                </div>

                <button className="auth-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Подождите…' : 'Войти'}
                </button>
                <div className="auth-switch">
                  Нет аккаунта? <a onClick={() => goStep('step1')}>Создать</a>
                </div>
              </form>
            </div>
          )}

          {screen === 'forgot' && (
            <div className={cardClass}>
              <AuthLogo />
              <div className="auth-title">Восстановление пароля</div>

              {error && <div className="auth-error">{error}</div>}

              {forgotMessage ? (
                <>
                  <div className="auth-note">{forgotMessage}</div>
                  <div className="auth-hint" style={{ marginTop: 12 }}>
                    Письмо не пришло? Проверьте папку «Спам» или отправьте запрос ещё раз.
                  </div>
                  <button className="auth-btn" type="button" onClick={() => goStep('login')} style={{ marginTop: 14 }}>
                    Вернуться ко входу
                  </button>
                  <button className="auth-back" type="button" onClick={() => setForgotMessage(null)}>
                    ← Отправить ещё раз
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgotSubmit}>
                  <div className="auth-sub" style={{ marginBottom: 16 }}>
                    Укажите почту аккаунта — пришлём ссылку для смены пароля. Она действует 30 минут.
                  </div>
                  <div className="auth-field">
                    <label>Электронная почта</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="oleg@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <button className="auth-btn" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Отправляем…' : 'Прислать ссылку'}
                  </button>
                  <button className="auth-back" type="button" onClick={() => goStep('login')}>
                    ← Назад ко входу
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ: ИНФО */}
      <div className="auth-right">
        <div className="ar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28, position: 'relative', zIndex: 1 }}>
            <LogoMark size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>QuickSell</span>
          </div>
          <RightPanel screen={screen} />
        </div>
      </div>
    </div>
  );
}

function AuthLogo() {
  return (
    <div className="auth-logo-sm">
      <LogoMark size={14} color="#1F1F1F" />
    </div>
  );
}

function StepBars({ done }: { done: number }) {
  return (
    <div className="auth-steps">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`astep${n <= done ? ' done' : ''}`} />
      ))}
    </div>
  );
}

function RightPanel({ screen }: { screen: Screen }) {
  if (screen === 'step1') {
    return (
      <div className="ar-pane active">
        <div className="ar-tagline">
          Знайте где <span>ваша прибыль</span> прямо сейчас
        </div>
        <div className="ar-sub">Четыре простых шага — и полная аналитика магазина у вас на экране.</div>
        <div className="ar-steps">
          <ArStep n={1} title="Ваши данные" sub="Имя, почта и пароль — 30 секунд" state="now" />
          <ArStep n={2} title="Подключение магазина" sub="Название и API токен из кабинета Kaspi" state="next" />
          <ArStep n={3} title="Доступ к данным" sub="Отдельный пользователь с ограниченными правами" state="next" />
          <ArStep n={4} title="Выбор тарифа" sub="Free — бесплатно и без срока" state="next" />
        </div>
        <div className="ar-visual">
          <div className="v-title">Что вы увидите после входа</div>
          <div className="mini-mock">
            <div className="mm-kpis">
              <div className="mm-kpi">
                <div className="l">Чистая прибыль</div>
                <div className="v" style={{ color: '#0F6E56' }}>
                  380 775 ₸
                </div>
              </div>
              <div className="mm-kpi">
                <div className="l">Маржа</div>
                <div className="v" style={{ color: '#534AB7' }}>
                  41.2%
                </div>
              </div>
            </div>
            <div className="mm-bars">
              <div style={{ height: '40%' }} />
              <div style={{ height: '55%' }} />
              <div style={{ height: '48%' }} />
              <div style={{ height: '70%' }} />
              <div style={{ height: '62%' }} />
              <div style={{ height: '88%', background: '#7F77DD' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'step2') {
    return (
      <div className="ar-pane active">
        <div className="ar-tagline">
          Где взять <span>API токен</span>
        </div>
        <div className="ar-sub" style={{ marginBottom: 16 }}>
          Займёт меньше минуты.
        </div>
        <div style={{ marginBottom: 20 }}>
          <a className="cab-link" href="https://idmc.shop.kaspi.kz" target="_blank" rel="noopener">
            Перейти в кабинет <IconExternalLink />
          </a>
        </div>
        <div className="token-guide">
          <TgStep n={1} text={<>Откройте <b>кабинет продавца</b> по кнопке выше</>} />
          <TgStep n={2} text={<>Перейдите в <b>Настройки → Токен API</b></>} />
          <TgStep n={3} text={<>Нажмите <b>«Скопировать»</b></>} />
          <TgStep n={4} text="Вставьте токен в поле слева — готово!" />
        </div>
        <div className="ar-visual" style={{ marginTop: 22 }}>
          <div className="v-title">Так выглядит в кабинете Kaspi</div>
          <div className="kaspi-mock">
            <div className="km-top">
              <div className="kd" />
              <span>Кабинет продавца</span>
            </div>
            <div style={{ padding: '8px 10px 4px', fontSize: 9.5, fontWeight: 700, color: '#1a1a1a' }}>Информация о магазине</div>
            <div className="km-tabs">
              <span className="km-tab">Общая информация</span>
              <span className="km-tab">Склады</span>
              <span className="km-tab">Kaspi Доставка</span>
              <span className="km-tab on">Токен API</span>
            </div>
            <div className="km-token-row">
              <div className="km-token-field">{/* Макет, не настоящий токен — реальные ключи в исходниках уходят в публичный бандл */}••••••••••••••••••••••••••••••••</div>
              <div className="km-copy">Скопировать</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'step3') {
    return (
      <div className="ar-pane active">
        <div className="ar-tagline">
          Создайте <span>пользователя</span> для QuickSell
        </div>
        <div className="ar-sub" style={{ marginBottom: 16 }}>
          Отдельный доступ с ограниченными правами — только то, что нужно системе.
        </div>
        <div style={{ marginBottom: 18 }}>
          <a className="cab-link" href="https://idmc.shop.kaspi.kz" target="_blank" rel="noopener">
            Перейти в кабинет <IconExternalLink />
          </a>
        </div>
        <div className="token-guide">
          <TgStep n={1} text={<>Откройте <b>кабинет продавца</b> по кнопке выше</>} />
          <TgStep n={2} text={<>Перейдите в раздел <b>Пользователи</b></>} />
          <TgStep n={3} text={<><b>Добавить пользователя</b> — придумайте имя, укажите почту. Номер не обязателен</>} />
          <TgStep n={4} text={<>Отметьте галочкой <b>только «Загрузка товаров»</b></>} />
          <TgStep n={5} text={<>Нажмите <b>«Создать пользователя»</b></>} />
          <TgStep n={6} text="Логин и пароль придут на почту — введите их слева" />
        </div>
        <div className="ar-visual" style={{ marginTop: 16 }}>
          <div className="v-title">Отметьте только этот пункт</div>
          <div className="kaspi-mock">
            <div className="km-top">
              <div className="kd" />
              <span>Новый пользователь</span>
            </div>
            <div className="km-check dim" style={{ paddingTop: 8 }}>
              <div className="cb" />
              Возврат заказов
            </div>
            <div className="km-sec">Управление товарами</div>
            <div className="km-check checked">
              <div className="cb" />
              Загрузка товаров
            </div>
            <div className="km-sec">Kaspi Marketing</div>
            <div className="km-check dim">
              <div className="cb" />
              Раздел Kaspi Marketing
            </div>
            <div className="km-create">Создать пользователя</div>
          </div>
        </div>
        <div className="sec-note">
          <div className="sn-title">
            <IconShield />
            Почему так безопаснее
          </div>
          <div className="sn-text">
            Мы намеренно не запрашиваем данные вашего личного входа. Вы создаёте отдельного пользователя со строго ограниченным доступом — только к тем
            функциям, которые нужны системе для работы. Этого пользователя можно удалить в любой момент, и доступ будет немедленно прекращён. Все данные
            шифруются и не передаются третьим лицам.
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'step4') {
    return (
      <div className="ar-pane active">
        <div className="ar-tagline">
          Проще, чем <span>один вечер</span> в Excel
        </div>
        <div className="ar-sub">Free — бесплатно и без срока. Pro за 15 000 ₸/мес открывает полную аналитику и AI-советы.</div>
        <div className="value-list">
          <ValueItem text="Чистая прибыль и все расходы — автоматически" />
          <ValueItem text="Статистика по каждому товару" />
          <ValueItem text="Калькулятор юнит-экономики" />
          <ValueItem text="AI-рекомендации для решений" />
        </div>
        <div className="ar-visual" style={{ marginTop: 22 }}>
          <div className="v-title">Экономия времени каждый месяц</div>
          <div className="mini-mock" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-around', padding: '14px 10px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#993C1D' }}>~12 ч</div>
              <div style={{ fontSize: 8, color: '#aaa', marginTop: 2 }}>вручную в Excel</div>
            </div>
            <div style={{ fontSize: 12, color: '#ccc' }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0F6E56' }}>0 мин</div>
              <div style={{ fontSize: 8, color: '#aaa', marginTop: 2 }}>с QuickSell</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'forgot') {
    return (
      <div className="ar-pane active">
        <div className="ar-tagline">
          Вернём <span>доступ</span> за пару минут
        </div>
        <div className="ar-sub">
          Пришлём на почту ссылку для смены пароля. Она действует 30 минут и срабатывает один раз.
        </div>
        <div className="sec-note" style={{ marginTop: 'auto' }}>
          <div className="sn-title">
            <IconShield />
            Почему так
          </div>
          <div className="sn-text">
            Мы не показываем, есть ли аккаунт с такой почтой, и не присылаем старый пароль — он хранится только в
            зашифрованном виде. После смены пароля все открытые сессии придётся авторизовать заново.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ar-pane active">
      <div className="ar-tagline">
        С возвращением! <span>👋</span>
      </div>
      <div className="ar-sub">Заказы, прибыль и расходы магазина — на одном экране.</div>
      {/* Иллюстрация, а не данные пользователя: до входа мы его цифр не знаем.
          Раньше блок назывался «Пока вас не было» и выдавал выдуманные
          заказы и прибыль за настоящие. */}
      <div className="ar-visual" style={{ marginTop: 'auto' }}>
        <div className="v-title">Так выглядит главная</div>
        <div className="mini-mock">
          <div className="mm-kpis">
            <div className="mm-kpi">
              <div className="l">Новых заказов</div>
              <div className="v">+18</div>
            </div>
            <div className="mm-kpi">
              <div className="l">Прибыль за неделю</div>
              <div className="v" style={{ color: '#0F6E56' }}>
                +92 400 ₸
              </div>
            </div>
          </div>
          <div className="mm-bars">
            <div style={{ height: '35%' }} />
            <div style={{ height: '52%' }} />
            <div style={{ height: '44%' }} />
            <div style={{ height: '66%' }} />
            <div style={{ height: '78%' }} />
            <div style={{ height: '90%', background: '#7F77DD' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArStep({ n, title, sub, state }: { n: number; title: string; sub: string; state: 'now' | 'next' | 'past' }) {
  return (
    <div className={`ar-step${state === 'now' ? ' now' : ''}${state === 'past' ? ' past' : ''}`}>
      <div className="num">{n}</div>
      <div>
        <div className="st-title">{title}</div>
        <div className="st-sub">{sub}</div>
      </div>
    </div>
  );
}

function TgStep({ n, text }: { n: number; text: ReactNode }) {
  return (
    <div className="tg-step">
      <div className="tg-num">{n}</div>
      <div className="tg-text">{text}</div>
    </div>
  );
}

function ValueItem({ text }: { text: string }) {
  return (
    <div className="value-item">
      <IconCheck />
      {text}
    </div>
  );
}
