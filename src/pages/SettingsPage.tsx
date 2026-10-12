import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { kaspiApi } from '../api/kaspi';
import { clearSetupDraft, peekSetupDraft } from '../lib/setupDraft';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import { useSeller } from '../context/SellerContext';
import { Pagination } from '../components/Pagination';
import { SearchField } from '../components/SearchField';
import { InfoHint } from '../components/InfoHint';
import { CostHistoryModal } from '../components/CostHistoryModal';
import { IconExternalLink } from '../components/Icons';
import type { AnalyticsSettings, ExpenseCategory, ExpenseCategoryKind, Product, Seller } from '../types/api';

const expenseColors = ['#7F77DD', '#1D9E75', '#EF9F27', '#D85A30', '#378ADD', '#888780', '#A32D2D', '#534AB7', '#854F0B', '#185FA5', '#0F6E56', '#5F5E5A'];
const TAX_COLOR = '#888780';

const CATEGORY_OPTIONS: { group: string; options: { label: string; kind: ExpenseCategoryKind }[] }[] = [
  {
    group: 'Операционные',
    options: [
      { label: 'Упаковка', kind: 'fixed' },
      { label: 'Доставка до склада', kind: 'fixed' },
      { label: 'Доставка покупателю', kind: 'fixed' },
      { label: 'Хранение на складе', kind: 'fixed' },
    ],
  },
  {
    group: 'Маркетинг',
    options: [
      { label: 'Реклама (Search Ads)', kind: 'fixed' },
      { label: 'Фотосъёмка товаров', kind: 'fixed' },
      { label: 'Промо / скидки', kind: 'fixed' },
    ],
  },
  {
    group: 'Платформа',
    options: [
      { label: 'Комиссия Kaspi', kind: 'percent' },
      { label: 'Эквайринг', kind: 'percent' },
      { label: 'Возвраты', kind: 'percent' },
    ],
  },
  {
    group: 'Прочее',
    options: [{ label: 'Зарплата (на ед.)', kind: 'fixed' }],
  },
];

/** Покрытие себестоимости по каталогу — нужно для полосы «Аналитика готова на N%». */
interface CostCoverage {
  total: number;
  filled: number;
}

/** Какие шаги подключения пропустили в мастере регистрации. */
export interface SetupNeeded {
  /** Не введён API токен (и название магазина) */
  token: boolean;
  /** Не введены логин и пароль пользователя Kaspi */
  access: boolean;
}

export function SettingsPage({ setupNeeded = null }: { setupNeeded?: SetupNeeded | null }) {
  const { currentSeller, isConnected, isReady, refresh: refreshSellers } = useSeller();
  const [settings, setSettings] = useState<AnalyticsSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CostCoverage | null>(null);
  // Что из пропущенного всё ещё не заполнено — по этому живёт баннер сверху
  const [setupRequested] = useState<SetupNeeded | null>(setupNeeded);
  const [missing, setMissing] = useState<SetupNeeded | null>(setupNeeded);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Баннер висит, пока магазин не подключён по-настоящему: и когда шаги мастера
  // пропущены, и когда продавца нет вовсе, и когда сессия Kaspi протухла.
  const setupIncomplete = !!missing && (missing.token || missing.access);
  const showSetupBanner = !bannerDismissed && isReady && (setupIncomplete || !isConnected);
  const bannerText = !currentSeller
    ? 'Остальные разделы откроются, как только магазин будет подключён. Введите данные и нажмите «Подключить магазин» — Kaspi пришлёт код на почту.'
    : !isConnected
      ? 'Сессия Kaspi истекла — товары и заказы не обновляются. Войдите заново в блоке «Подключение Kaspi».'
      : 'Без API токена и доступа аналитика не будет обновляться. Заполните подсвеченные поля ниже.';

  useEffect(() => {
    if (!currentSeller) {
      setSettings(null);
      return;
    }
    analyticsApi
      .getSettings(currentSeller.id)
      .then(setSettings)
      .catch((err) => setSettingsError(extractErrorMessage(err, 'Не удалось загрузить настройки аналитики')));
  }, [currentSeller]);

  return (
    <div>
      {showSetupBanner && (
        <div className="setup-banner">
          <div className="sb-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="sb-title">{currentSeller && !isConnected ? 'Нужно войти в Kaspi заново' : 'Завершите подключение магазина'}</div>
            <div className="sb-text">{bannerText}</div>
          </div>
          <button className="sb-close" onClick={() => setBannerDismissed(true)} title="Скрыть">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <ProgressBanner settings={settings} coverage={coverage} />
      {settingsError && (
        <div style={{ background: '#FAECE7', color: '#993C1D', border: '0.5px solid #F0997B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          {settingsError}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <KaspiConnectionCard
          currentSeller={currentSeller}
          refreshSellers={refreshSellers}
          setup={setupRequested}
          onMissingChange={setMissing}
        />
        <ExpenseCategoriesCard currentSeller={currentSeller} settings={settings} onSettingsChange={setSettings} />
        <GoalsCard currentSeller={currentSeller} settings={settings} onSettingsChange={setSettings} />
      </div>
      <ProductCostTable currentSeller={currentSeller} onCoverageChange={setCoverage} />
    </div>
  );
}

/** Готовность аналитики: подключение, расходы, себестоимость товаров, цели. */
function computeReadiness(settings: AnalyticsSettings | null, hasSeller: boolean, coverage: CostCoverage | null) {
  const kaspiOk = hasSeller;
  const expensesOk = !!settings && settings.expenseCategories.length > 0;
  const goalsOk = !!settings && settings.goals.targetProfitPct > 0 && settings.goals.minProfitPct > 0 && settings.goals.paybackMonths > 0;
  const productsRatio = coverage && coverage.total > 0 ? coverage.filled / coverage.total : 0;
  const productsOk = !!coverage && coverage.total > 0 && coverage.filled === coverage.total;

  const pct = Math.round(((kaspiOk ? 1 : 0) + (expensesOk ? 1 : 0) + (goalsOk ? 1 : 0) + productsRatio) * 25);

  let hint: string;
  if (!kaspiOk) hint = 'Подключите магазин Kaspi, чтобы начать';
  else if (!expensesOk) hint = 'Осталось: добавить категории расходов';
  else if (!productsOk) {
    const missing = coverage ? coverage.total - coverage.filled : 0;
    hint = coverage && coverage.total > 0 ? `Осталось: заполнить себестоимость ${missing} товаров` : 'Осталось: загрузить товары из Kaspi';
  } else if (!goalsOk) hint = 'Осталось: задать цели бизнеса';
  else hint = 'Всё готово — аналитика считается полностью';

  return { kaspiOk, expensesOk, goalsOk, productsOk, productsRatio, pct, hint };
}

function ProgressBanner({ settings, coverage }: { settings: AnalyticsSettings | null; coverage: CostCoverage | null }) {
  const { isConnected } = useSeller();
  const { kaspiOk, expensesOk, goalsOk, productsOk, productsRatio, pct, hint } = computeReadiness(settings, isConnected, coverage);

  return (
    <div className="progress-banner" style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a' }}>
            Аналитика готова на <span style={{ color: '#534AB7' }}>{pct}%</span>
          </span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{hint}</span>
        </div>
        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#7F77DD,#AFA9EC)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <ProgressStep label="Kaspi" ok={kaspiOk} />
        <ProgressStep label="Расходы" ok={expensesOk} />
        <ProgressStep label="Товары" ok={productsOk} warn={!productsOk && productsRatio > 0} />
        <ProgressStep label="Цели" ok={goalsOk} />
      </div>
    </div>
  );
}

function ProgressStep({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: ok ? '#0F6E56' : warn ? '#EF9F27' : '#aaa' }}>{ok ? '✓' : warn ? '⚠' : '○'}</div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{label}</div>
    </div>
  );
}

/** Сколько живёт код из письма — Kaspi даёт около трёх минут. */
const CODE_TTL_SEC = 180;
/** Пауза между повторными отправками: Kaspi режет частые запросы. */
const RESEND_COOLDOWN_SEC = 45;

interface PendingMfa {
  pendingId: string;
  emailSentTo: string;
  /** Когда код был отправлен — от этого считаем оставшееся время. */
  sentAt: number;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function KaspiConnectionCard({
  currentSeller,
  refreshSellers,
  setup,
  onMissingChange,
}: {
  currentSeller: ReturnType<typeof useSeller>['currentSeller'];
  refreshSellers: () => Promise<void>;
  setup: SetupNeeded | null;
  onMissingChange: (missing: SetupNeeded | null) => void;
}) {
  // Черновик из мастера регистрации подхватывается один раз при монтировании:
  // человек уже ввёл это на шагах 2–3, второй раз спрашивать нельзя.
  const [draft] = useState(() => peekSetupDraft());
  const [name, setName] = useState(draft?.storeName ?? '');
  const [kaspiLogin, setKaspiLogin] = useState(draft?.kaspiLogin ?? '');
  const [kaspiPassword, setKaspiPassword] = useState(draft?.kaspiPassword ?? '');
  const [connectToken, setConnectToken] = useState(draft?.kaspiToken ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ orders: number; products: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Recovery: attach a Kaspi API token later if it was skipped at registration.
  const [recoverToken, setRecoverToken] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  // Токен только что отправлен, заказы ещё догружаются — плашку «вставьте токен» прячем.
  const [tokenAttached, setTokenAttached] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Двухфакторка Kaspi: после «Подключить» ждём код из письма.
  const [pending, setPending] = useState<PendingMfa | null>(null);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // Токен, отданный вместе с логином: после подтверждения кода по нему
  // догружаем заказы, чтобы «Прибыль и расходы» не пустовала.
  const tokenForBackfill = useRef<string>('');

  // Секундный тик нужен только пока ждём код — иначе карточка не перерисовывается зря.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pending]);

  const codeSecondsLeft = pending ? Math.max(0, CODE_TTL_SEC - Math.floor((now - pending.sentAt) / 1000)) : 0;
  const resendSecondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  // Подсветка снимается сама, как только поле заполнено — как в прототипе.
  // Шаг 2 мастера — это название магазина вместе с токеном, поэтому они в одной группе.
  // Как только магазин создан, «пропущенные шаги» теряют смысл: поля формы
  // уже пустые не потому, что их пропустили, а потому, что форма ушла.
  // Без этой проверки после перезагрузки висел бы баннер «Завершите подключение».
  const setupActive = !!setup && !currentSeller;
  const needToken = setupActive && !!setup.token && !(name.trim() && connectToken.trim());
  const needAccess = setupActive && !!setup.access && !(kaspiLogin.trim() && kaspiPassword.trim());

  useEffect(() => {
    onMissingChange(setup ? { token: needToken, access: needAccess } : null);
  }, [setup, needToken, needAccess, onMissingChange]);

  // Пропустили онбординг — сразу подводим к блоку подключения.
  useEffect(() => {
    if (!setup || (!setup.token && !setup.access)) return;
    const timer = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => clearTimeout(timer);
  }, [setup]);

  const loadCounts = useCallback(() => {
    if (!currentSeller) {
      setCounts(null);
      return;
    }
    Promise.all([
      kaspiApi.listOrders(currentSeller.id, { page: 1, limit: 1 }).then((r) => r.total).catch(() => 0),
      kaspiApi.listProducts(currentSeller.id, { page: 1, limit: 1 }).then((r) => r.total).catch(() => 0),
    ]).then(([orders, products]) => setCounts({ orders, products }));
  }, [currentSeller]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  /** Общий финал для connect / verify / reauth: магазин подключён. */
  const finishConnected = async (seller: Seller) => {
    clearSetupDraft();
    if (tokenForBackfill.current) {
      // Токен ушёл вместе с логином — заказы догружаются в фоне. Пока они
      // не пришли, счётчик показывает 0, и плашку «вставьте токен» надо
      // придержать, иначе она попросит то, что уже отправлено.
      tokenForBackfill.current = '';
      setTokenAttached(true);
      kaspiApi
        .backfillOrders(seller.id)
        .then((res) => {
          setSyncInfo(`Загружено ${res.orders} заказов — «Прибыль и расходы» уже считает выручку.`);
          loadCounts();
        })
        .catch(() => undefined);
    }
    setPending(null);
    setCode('');
    await refreshSellers();
  };

  const startMfa = (pendingId: string, emailSentTo: string) => {
    const sentAt = Date.now();
    setPending({ pendingId, emailSentTo, sentAt });
    setResendAvailableAt(sentAt + RESEND_COOLDOWN_SEC * 1000);
    setNow(sentAt);
    setCode('');
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSyncInfo(null);
    setIsSubmitting(true);
    try {
      tokenForBackfill.current = connectToken.trim();
      const res = await kaspiApi.createSeller({
        name: name.trim(),
        kaspiLogin: kaspiLogin.trim(),
        kaspiPassword,
        kaspiApiToken: connectToken.trim() || undefined,
      });
      if (res.status === 'mfa_required') {
        startMfa(res.pendingId, res.emailSentTo);
      } else {
        await finishConnected(res.seller);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось подключить магазин'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || code.length !== 6) return;
    setError(null);
    setIsVerifying(true);
    try {
      const res = await kaspiApi.verifyCode({ pendingId: pending.pendingId, code });
      if (res.status === 'connected') {
        await finishConnected(res.seller);
        setSyncInfo('Магазин подключён. Дальше вход в Kaspi будет автоматическим.');
      } else {
        // Бэкенд попросил код повторно — редкость, но ветку надо закрыть.
        startMfa(res.pendingId, res.emailSentTo);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Код не подошёл. Проверьте письмо или запросите новый.'));
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!pending || resendSecondsLeft > 0) return;
    setError(null);
    setIsResending(true);
    try {
      const res = await kaspiApi.resendCode(pending.pendingId);
      startMfa(pending.pendingId, res.emailSentTo || pending.emailSentTo);
      setSyncInfo(`Новый код отправлен на ${res.emailSentTo || pending.emailSentTo}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось отправить код повторно — подождите немного'));
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelMfa = () => {
    // Данные формы не трогаем: человек вернётся и нажмёт «Подключить» снова.
    setPending(null);
    setCode('');
    setError(null);
    tokenForBackfill.current = '';
  };

  /** Сессия Kaspi протухла — входим заново по сохранённому логину. */
  const handleReauth = async () => {
    if (!currentSeller) return;
    setError(null);
    setSyncInfo(null);
    setIsSubmitting(true);
    try {
      const res = await kaspiApi.reauth(currentSeller.id);
      if (res.status === 'mfa_required') startMfa(res.pendingId, res.emailSentTo);
      else await finishConnected(res.seller);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось войти в Kaspi заново'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async () => {
    if (!currentSeller) return;
    setIsSyncing(true);
    setError(null);
    setSyncInfo(null);
    try {
      const res = await kaspiApi.sync(currentSeller.id);
      setSyncInfo(`Загружено ${res.upserted} из ${res.total} товаров`);
      await refreshSellers();
      loadCounts();
    } catch (err) {
      setError(extractErrorMessage(err, 'Синхронизация не удалась'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Токен сохраняем и сразу отпускаем кнопку. Догрузка заказов тянет
  // ~90 дней истории и идёт минуты — держать на ней «Подключаем…» нельзя:
  // выглядит как зависший запрос. Заказы придут в фоне, счётчик обновится сам.
  const handleAttachToken = async () => {
    if (!currentSeller || !recoverToken.trim()) return;
    setIsAttaching(true);
    setError(null);
    setSyncInfo(null);
    try {
      await kaspiApi.updateSeller(currentSeller.id, { kaspiApiToken: recoverToken.trim() });
      setRecoverToken('');
      setTokenAttached(true);
      setSyncInfo('Токен сохранён. Загружаем заказы из Kaspi — это займёт несколько минут, страницу можно не ждать.');
      const sellerId = currentSeller.id;
      kaspiApi
        .backfillOrders(sellerId)
        .then((res) => {
          setSyncInfo(`Загружено ${res.orders} заказов — «Прибыль и расходы» уже считает выручку.`);
          loadCounts();
        })
        .catch((err) => setError(extractErrorMessage(err, 'Токен сохранён, но заказы загрузить не удалось')));
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить токен'));
    } finally {
      setIsAttaching(false);
    }
  };

  const needsReauth = !!currentSeller && currentSeller.cookieStatus !== 'ok';
  const connected = !!currentSeller && !needsReauth;
  const statusLabel = connected ? 'Подключён' : pending ? 'Ждём код' : needsReauth ? 'Нужен вход' : 'Не подключён';
  const statusTone = connected
    ? { bg: '#E1F5EE', color: '#085041' }
    : pending || needsReauth || needToken || needAccess
      ? { bg: '#FAEEDA', color: '#854F0B' }
      : { bg: '#f0f0f0', color: '#888' };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    border: '0.5px solid rgba(0,0,0,0.12)',
    borderRadius: 7,
    background: '#fafafa',
    color: '#555',
    fontFamily: 'inherit',
    marginBottom: 8,
  };

  return (
    <div ref={cardRef} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <StepBadge n={1} ok={connected} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Подключение Kaspi</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, background: statusTone.bg, color: statusTone.color, padding: '2px 7px', borderRadius: 4 }}>
          {statusLabel}
        </span>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
      {syncInfo && (
        <div style={{ fontSize: 11, color: '#0F6E56', background: '#F8FDF9', border: '0.5px solid #9FE1CB', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
          {syncInfo}
        </div>
      )}

      {pending ? (
        <form onSubmit={handleVerify} className="mfa-panel">
          <div className="mfa-note">
            <div className="mfa-note-title">Kaspi отправил код подтверждения</div>
            <div className="mfa-note-text">
              Введите код из письма на <b>{pending.emailSentTo}</b>. Код действует около 3 минут. Подтвердить нужно только один раз — дальше
              вход будет автоматическим.
            </div>
          </div>
          <label className="mfa-label">
            Код из письма
            <span className="mfa-ttl">
              {codeSecondsLeft > 0 ? `действует ещё ${formatCountdown(codeSecondsLeft)}` : 'срок истёк — запросите новый'}
            </span>
          </label>
          <input
            className="mfa-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="1 2 3 4 5 6"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={isVerifying}
          />
          <button type="submit" className="auth-submit" disabled={isVerifying || code.length !== 6} style={{ marginTop: 10 }}>
            {isVerifying ? 'Проверяем…' : 'Подтвердить'}
          </button>
          <div className="mfa-actions">
            <button type="button" className="mfa-link" onClick={handleResend} disabled={isResending || resendSecondsLeft > 0}>
              {isResending ? 'Отправляем…' : resendSecondsLeft > 0 ? `Отправить ещё раз через ${resendSecondsLeft} с` : 'Отправить код ещё раз'}
            </button>
            <button type="button" className="mfa-link muted" onClick={handleCancelMfa}>
              Отмена
            </button>
          </div>
        </form>
      ) : currentSeller ? (
        <>
          {needsReauth ? (
            <div style={{ background: '#FFFBEB', border: '0.5px solid #F5D98B', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#854F0B', fontWeight: 500, marginBottom: 2 }}>Сессия Kaspi истекла</div>
              <div style={{ fontSize: 10.5, color: '#B8791C', lineHeight: 1.5, marginBottom: 8 }}>
                Товары и заказы не обновляются. Войдите заново — если Kaspi попросит код, он придёт на почту.
              </div>
              <button
                onClick={handleReauth}
                disabled={isSubmitting}
                style={{ width: '100%', padding: 7, borderRadius: 7, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {isSubmitting ? 'Входим…' : 'Войти в Kaspi заново'}
              </button>
            </div>
          ) : (
            <div style={{ background: '#F8FDF9', border: '0.5px solid #9FE1CB', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#0F6E56', fontWeight: 500, marginBottom: 2 }}>✓ Загружено успешно</div>
              <div style={{ fontSize: 11, color: '#1D9E75' }}>
                {counts ? `${counts.orders} заказов` : '…'} · {counts ? `${counts.products} товаров` : '…'} · {currentSeller.name}
              </div>
            </div>
          )}

          {/* Recovery: no orders yet → the Kaspi API token was likely skipped at
              registration. Let the user attach it now so profit analytics works. */}
          {connected && !tokenAttached && counts && counts.orders === 0 && (
            <div style={{ background: '#FFFBEB', border: '0.5px solid #F5D98B', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#854F0B', fontWeight: 500, marginBottom: 2 }}>Аналитика заказов не подключена</div>
              <div style={{ fontSize: 10.5, color: '#B8791C', lineHeight: 1.5, marginBottom: 8 }}>
                Заказов пока нет. Вставьте Kaspi API токен из кабинета продавца — тогда «Прибыль и расходы» начнёт считать выручку.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  value={recoverToken}
                  onChange={(e) => setRecoverToken(e.target.value)}
                  placeholder="Kaspi API токен"
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '0.5px solid rgba(0,0,0,0.14)', borderRadius: 7, fontFamily: 'inherit', background: '#fff', color: '#1a1a1a' }}
                />
                <button
                  onClick={handleAttachToken}
                  disabled={isAttaching || !recoverToken.trim()}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 7, background: '#7F77DD', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  {isAttaching ? 'Подключаем…' : 'Подключить'}
                </button>
              </div>
            </div>
          )}

          {/* Secrets are never returned by the API — these read-only fields just
              signal "stored & hidden", matching the prototype's connected look. */}
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>API токен</div>
          <input type="text" value="••••••••••••••••••" readOnly style={inputStyle} />
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>Логин пользователя Kaspi</div>
          <input type="text" value="••••••••••••" readOnly style={inputStyle} />
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>Пароль пользователя Kaspi</div>
          <input type="text" value="••••••••••" readOnly style={inputStyle} />

          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
            Последняя синхронизация: {currentSeller.lastSyncAt ? new Date(currentSeller.lastSyncAt).toLocaleString('ru') : 'ещё не выполнялась'}
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing || needsReauth}
            style={{ width: '100%', padding: 7, borderRadius: 7, border: '0.5px solid rgba(127,119,221,0.3)', background: '#EEEDFE', color: '#534AB7', fontSize: 12, fontWeight: 500, cursor: needsReauth ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: needsReauth ? 0.6 : 1 }}
          >
            {isSyncing ? 'Синхронизация…' : '⟳ Синхронизировать'}
          </button>
        </>
      ) : (
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="field">
            <label style={{ fontSize: 11 }}>Название магазина</label>
            <input
              className={needToken ? 'field-need' : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo Store KZ"
              required
              style={{ fontSize: 12, padding: '6px 10px' }}
            />
          </div>
          <div className="field">
            <label style={{ fontSize: 11 }}>
              Kaspi API токен <span style={{ color: '#bbb' }}>· для выручки и прибыли</span>
            </label>
            <input
              className={needToken ? 'field-need' : undefined}
              value={connectToken}
              onChange={(e) => setConnectToken(e.target.value)}
              placeholder="Вставьте токен из кабинета Kaspi"
              style={{ fontSize: 12, padding: '6px 10px', fontFamily: 'monospace' }}
            />
          </div>
          <div className="field">
            <label style={{ fontSize: 11 }}>Логин пользователя Kaspi</label>
            <input
              className={needAccess ? 'field-need' : undefined}
              value={kaspiLogin}
              onChange={(e) => setKaspiLogin(e.target.value)}
              placeholder="Логин из письма Kaspi"
              autoComplete="off"
              required
              style={{ fontSize: 12, padding: '6px 10px' }}
            />
          </div>
          <div className="field">
            <label style={{ fontSize: 11 }}>Пароль пользователя Kaspi</label>
            <input
              className={needAccess ? 'field-need' : undefined}
              type="password"
              value={kaspiPassword}
              onChange={(e) => setKaspiPassword(e.target.value)}
              placeholder="Пароль из письма Kaspi"
              autoComplete="new-password"
              required
              style={{ fontSize: 12, padding: '6px 10px' }}
            />
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 11.5, color: '#7F77DD', cursor: 'pointer' }}
          >
            {helpOpen ? '▾ Скрыть инструкцию' : '▸ Где взять токен и логин'}
          </button>
          {helpOpen && <ConnectHelp />}

          {/* Kaspi пришлёт код на почту продавца — предупреждаем до нажатия, а не после */}
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 7, padding: '7px 10px' }}>
            После нажатия Kaspi отправит код подтверждения на почту пользователя — его нужно будет ввести один раз.
          </div>

          <button type="submit" disabled={isSubmitting} className="auth-submit" style={{ marginTop: 2 }}>
            {isSubmitting ? 'Подключаем…' : 'Подключить магазин'}
          </button>
        </form>
      )}
    </div>
  );
}

/** Инструкция из мастера регистрации — переехала сюда вместе с подключением магазина. */
function ConnectHelp() {
  return (
    <div style={{ background: '#F8F7FF', border: '0.5px solid #AFA9EC', borderRadius: 10, padding: '14px 16px' }}>
      <a
        className="cab-link"
        href="https://idmc.shop.kaspi.kz"
        target="_blank"
        rel="noopener"
        style={{ background: '#7F77DD', borderColor: '#7F77DD' }}
      >
        Перейти в кабинет Kaspi <IconExternalLink />
      </a>

      <HelpSection title="Где взять API токен" />
      <HelpStep n={1} text={<>Откройте <b>кабинет продавца</b> по кнопке выше</>} />
      <HelpStep n={2} text={<>Перейдите в раздел <b>«Настройки → Токен API»</b></>} />
      <HelpStep n={3} text={<>Нажмите <b>«Скопировать»</b> и вставьте токен в поле выше</>} />

      <HelpSection title="Как создать пользователя для QuickSell" />
      <HelpStep n={1} text={<>В кабинете продавца откройте раздел <b>«Пользователи»</b></>} />
      <HelpStep
        n={2}
        text={
          <>
            Нажмите <b>«Добавить пользователя»</b>, придумайте имя и укажите почту. Номер телефона указывать не обязательно
          </>
        }
      />
      <HelpStep n={3} text={<>В списке прав отметьте галочкой <b>только «Загрузка товаров»</b> — больше ничего не нужно</>} />
      <HelpStep n={4} text={<>Нажмите <b>«Создать пользователя»</b></>} />
      <HelpStep n={5} text={<>Логин и пароль придут на указанную почту — введите их в поля выше</>} />

      <div
        style={{
          background: 'rgba(29,158,117,0.07)',
          border: '0.5px solid rgba(93,202,165,0.35)',
          borderRadius: 8,
          padding: '10px 12px',
          marginTop: 14,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 500, color: '#0F6E56', marginBottom: 4 }}>Почему так безопаснее</div>
        <div style={{ fontSize: 11, color: '#3f7a68', lineHeight: 1.65 }}>
          Мы намеренно не запрашиваем данные вашего личного входа в Kaspi. Вы создаёте отдельного пользователя с одним-единственным
          правом — загрузкой товаров. Удалить его можно в любой момент, и доступ прекратится сразу.
        </div>
      </div>
    </div>
  );
}

function HelpSection({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        color: '#534AB7',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        margin: '16px 0 10px',
      }}
    >
      {title}
    </div>
  );
}

function HelpStep({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(127,119,221,0.18)',
          color: '#534AB7',
          fontSize: 9.5,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 12, color: '#5f57a8', lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

function StepBadge({ n, ok }: { n: number; ok: boolean }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: ok ? '#E1F5EE' : '#FAEEDA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: ok ? '#085041' : '#854F0B',
        flexShrink: 0,
      }}
    >
      {n}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  background: '#fafafa',
  borderRadius: 7,
  border: '0.5px solid rgba(0,0,0,0.06)',
};

const rowInputStyle: React.CSSProperties = {
  width: 62,
  padding: '4px 8px',
  fontSize: 12.5,
  border: '0.5px solid rgba(0,0,0,0.1)',
  borderRadius: 5,
  textAlign: 'right',
  fontFamily: 'inherit',
  background: '#fff',
};

function ExpenseCategoriesCard({
  currentSeller,
  settings,
  onSettingsChange,
}: {
  currentSeller: ReturnType<typeof useSeller>['currentSeller'];
  settings: AnalyticsSettings | null;
  onSettingsChange: (settings: AnalyticsSettings) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [taxInput, setTaxInput] = useState('');

  const categories = useMemo(
    () => [...(settings?.expenseCategories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [settings],
  );

  const taxPercent = settings?.taxPercent ?? 0;

  useEffect(() => {
    setTaxInput(settings ? String(settings.taxPercent) : '');
  }, [settings?.taxPercent]);

  const selectedKind: ExpenseCategoryKind = useMemo(() => {
    for (const group of CATEGORY_OPTIONS) {
      const found = group.options.find((o) => o.label === selectedOption);
      if (found) return found.kind;
    }
    return 'fixed';
  }, [selectedOption]);

  const isCustom = selectedOption === '__custom__';

  const totalFixed = categories.filter((c) => c.kind === 'fixed').reduce((sum, c) => sum + c.value, 0);
  // Налоги — такая же процентная статья расходов, поэтому и в «Итого» она входит наравне с остальными.
  const pctParts = [...categories.filter((c) => c.kind === 'percent').map((c) => `${c.value}%`), `${taxPercent}%`];
  const totalLabel = `Итого: ${totalFixed.toLocaleString('ru')} ₸${pctParts.length ? ' + ' + pctParts.join(' + ') : ''}`;

  const addCategory = async () => {
    if (!currentSeller || !settings || !selectedOption) return;
    const name = isCustom ? customName.trim() || 'Своя категория' : selectedOption;
    const kind: ExpenseCategoryKind = isCustom ? 'fixed' : selectedKind;
    const value = parseFloat(amount) || 0;
    const color = expenseColors[categories.length % expenseColors.length];
    setIsAdding(true);
    setError(null);
    try {
      const created = await analyticsApi.addExpenseCategory(currentSeller.id, { name, kind, value, color });
      onSettingsChange({ ...settings, expenseCategories: [...settings.expenseCategories, created] });
      setFormOpen(false);
      setSelectedOption('');
      setCustomName('');
      setAmount('');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось добавить категорию'));
    } finally {
      setIsAdding(false);
    }
  };

  const updateLocalValue = (id: string, raw: string) => {
    if (!settings) return;
    const value = parseFloat(raw) || 0;
    onSettingsChange({ ...settings, expenseCategories: settings.expenseCategories.map((c) => (c.id === id ? { ...c, value } : c)) });
  };

  const persistValue = async (category: ExpenseCategory) => {
    if (!currentSeller) return;
    try {
      await analyticsApi.updateExpenseCategory(currentSeller.id, category.id, { value: category.value });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить изменения'));
    }
  };

  const deleteCategory = async (id: string) => {
    if (!currentSeller || !settings) return;
    const prevCategories = settings.expenseCategories;
    onSettingsChange({ ...settings, expenseCategories: prevCategories.filter((c) => c.id !== id) });
    try {
      await analyticsApi.deleteExpenseCategory(currentSeller.id, id);
    } catch (err) {
      onSettingsChange({ ...settings, expenseCategories: prevCategories });
      setError(extractErrorMessage(err, 'Не удалось удалить категорию'));
    }
  };

  const toggleAutoApply = async (checked: boolean) => {
    if (!currentSeller || !settings) return;
    onSettingsChange({ ...settings, applyExpensesAuto: checked });
    try {
      const updated = await analyticsApi.updateSettings(currentSeller.id, { applyExpensesAuto: checked });
      // Сливаем, а не заменяем: ответ PATCH раньше приходил без expenseCategories,
      // и замена целиком роняла страницу на следующем рендере.
      onSettingsChange({ ...settings, ...updated });
    } catch (err) {
      onSettingsChange({ ...settings, applyExpensesAuto: !checked });
      setError(extractErrorMessage(err, 'Не удалось сохранить настройку'));
    }
  };

  const persistTax = async () => {
    if (!currentSeller || !settings) return;
    const value = parseFloat(taxInput) || 0;
    if (value === settings.taxPercent) return;
    try {
      const updated = await analyticsApi.updateSettings(currentSeller.id, { taxPercent: value });
      // Сливаем, а не заменяем: ответ PATCH раньше приходил без expenseCategories,
      // и замена целиком роняла страницу на следующем рендере.
      onSettingsChange({ ...settings, ...updated });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить налоговую ставку'));
    }
  };

  if (!settings) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px', color: '#aaa', fontSize: 12 }}>
        {currentSeller ? 'Загрузка категорий расходов…' : 'Подключите магазин Kaspi (шаг 1)'}
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <StepBadge n={2} ok={categories.length > 0} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Категории расходов</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, background: '#EEEDFE', color: '#534AB7', padding: '2px 7px', borderRadius: 4 }}>{totalLabel}</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#888', marginBottom: 10 }}>Применяются к каждой единице товара</div>

      {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 }}>
        {categories.map((c) => (
          <div key={c.id} style={rowStyle}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: '#333', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
            <input
              type="number"
              value={c.value}
              onChange={(ev) => updateLocalValue(c.id, ev.target.value)}
              onBlur={() => persistValue(c)}
              style={rowInputStyle}
            />
            <span style={{ fontSize: 12, color: '#aaa', minWidth: 16 }}>{c.kind === 'percent' ? '%' : '₸'}</span>
            <button
              onClick={() => deleteCategory(c.id)}
              title="Удалить"
              style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Налоги — системная статья: оформлена как остальные, но не удаляется. */}
        <div style={rowStyle}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: TAX_COLOR, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: '#333', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Налоги
          </span>
          <input type="number" value={taxInput} onChange={(e) => setTaxInput(e.target.value)} onBlur={persistTax} style={rowInputStyle} />
          <span style={{ fontSize: 12, color: '#aaa', minWidth: 16 }}>%</span>
          <span
            title="Системная статья — считается от выручки и не удаляется"
            style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#ddd', fontSize: 11 }}
          >
            ⌾
          </span>
        </div>
      </div>

      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          style={{ width: '100%', padding: 7, borderRadius: 7, border: '0.5px dashed rgba(127,119,221,0.4)', background: 'transparent', color: '#7F77DD', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Добавить категорию
        </button>
      ) : (
        <div style={{ background: '#F8F7FF', border: '0.5px solid #AFA9EC', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, color: '#534AB7', fontWeight: 500, marginBottom: 8 }}>Новая категория</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, fontFamily: 'inherit', background: '#fff', color: '#333', cursor: 'pointer' }}
            >
              <option value="" disabled>
                Выберите категорию...
              </option>
              {CATEGORY_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((o) => (
                    <option key={o.label} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Прочее">
                <option value="__custom__">⚙️ Своя категория</option>
              </optgroup>
            </select>
            {isCustom && (
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Название категории"
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, fontFamily: 'inherit', background: '#fff' }}
              />
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Сумма"
                style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, fontFamily: 'inherit', background: '#fff' }}
              />
              <span style={{ fontSize: 12, color: '#888', minWidth: 14 }}>{isCustom ? '₸' : selectedKind === 'percent' ? '%' : '₸'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addCategory} disabled={isAdding} style={{ flex: 1, padding: 6, borderRadius: 7, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isAdding ? 'Добавляем…' : 'Добавить'}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#888' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          id="use-defaults"
          checked={settings.applyExpensesAuto}
          onChange={(e) => toggleAutoApply(e.target.checked)}
          style={{ accentColor: '#7F77DD', width: 13, height: 13 }}
        />
        <label htmlFor="use-defaults" style={{ fontSize: 11, color: '#888', cursor: 'pointer' }}>
          Применять ко всем товарам автоматически
        </label>
      </div>
    </div>
  );
}

function GoalsCard({
  currentSeller,
  settings,
  onSettingsChange,
}: {
  currentSeller: ReturnType<typeof useSeller>['currentSeller'];
  settings: AnalyticsSettings | null;
  onSettingsChange: (settings: AnalyticsSettings) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const commit = async (patch: { targetProfitPct?: number; minProfitPct?: number; paybackMonths?: number }) => {
    if (!currentSeller || !settings) return;
    try {
      const updated = await analyticsApi.updateSettings(currentSeller.id, patch);
      // Сливаем, а не заменяем: ответ PATCH раньше приходил без expenseCategories,
      // и замена целиком роняла страницу на следующем рендере.
      onSettingsChange({ ...settings, ...updated });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить цель'));
    }
  };

  if (!settings) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px', color: '#aaa', fontSize: 12 }}>
        {currentSeller ? 'Загрузка целей…' : 'Подключите магазин Kaspi (шаг 1)'}
      </div>
    );
  }

  const goalsOk = settings.goals.targetProfitPct > 0 && settings.goals.minProfitPct > 0 && settings.goals.paybackMonths > 0;

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <StepBadge n={4} ok={goalsOk} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Цели бизнеса</span>
      </div>
      {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <GoalRow label="Хочу зарабатывать" suffix="% с продаж" value={settings.goals.targetProfitPct} onCommit={(v) => commit({ targetProfitPct: v })} />
        <GoalRow label="Минимум допустимый" suffix="%" value={settings.goals.minProfitPct} onCommit={(v) => commit({ minProfitPct: v })} />
        <GoalRow label="Окупаемость за" suffix="мес." value={settings.goals.paybackMonths} onCommit={(v) => commit({ paybackMonths: v })} />
      </div>
    </div>
  );
}

function GoalRow({ label, suffix, value, onCommit }: { label: string; suffix: string; value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{label}</span>
      <input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(local) || 0;
          if (parsed !== value) onCommit(parsed);
        }}
        style={{ width: 58, padding: '4px 8px', fontSize: 12, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 6, textAlign: 'right', fontFamily: 'inherit' }}
      />
      <span style={{ fontSize: 11, color: '#aaa', width: 74, textAlign: 'left' }}>{suffix}</span>
    </div>
  );
}

const COST_PAGE_LIMIT = 20;
const SCAN_PAGE_SIZE = 200;
const SCAN_MAX_PAGES = 10;

interface CatalogScan {
  /** Сколько товаров реально просмотрено (может быть меньше total на огромных каталогах). */
  scanned: number;
  missing: Product[];
  /**
   * Медиана доли себестоимости в цене по заполненным товарам, %. Отдельного
   * поля под применённый процент в API нет, поэтому восстанавливаем его из
   * самих данных — иначе «Быстрый старт» каждый раз стартовал бы с 60%.
   */
  medianCostPercent: number | null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Проходит каталог постранично и собирает товары без себестоимости. */
async function scanCatalog(sellerId: string, search: string): Promise<CatalogScan> {
  const all: Product[] = [];
  for (let page = 1; page <= SCAN_MAX_PAGES; page++) {
    const res = await kaspiApi.listProducts(sellerId, { page, limit: SCAN_PAGE_SIZE, search: search || undefined });
    all.push(...res.data);
    if (res.data.length === 0 || all.length >= res.total) break;
  }
  const ratios = all
    .filter((p) => p.costPrice != null && p.priceMin > 0)
    .map((p) => ((p.costPrice as number) / p.priceMin) * 100);
  const med = median(ratios);
  return {
    scanned: all.length,
    missing: all.filter((p) => p.costPrice == null),
    medianCostPercent: med == null ? null : Math.round(med),
  };
}

function ProductCostTable({
  currentSeller,
  onCoverageChange,
}: {
  currentSeller: ReturnType<typeof useSeller>['currentSeller'];
  onCoverageChange: (coverage: CostCoverage | null) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Открытая карточка товара: история цены и себестоимости.
  const [openCard, setOpenCard] = useState<{ sku: string; title: string } | null>(null);
  // Быстрый старт считает себестоимость как % от цены продажи каждого товара.
  // Стартовое значение подтягиваем из каталога, пока пользователь его не трогал.
  const [bulkPercent, setBulkPercent] = useState('');
  const percentTouched = useRef(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Полный проход по каталогу: питает бейдж «N из M не заполнено», полосу
  // готовности сверху и массовое заполнение — независимо от того, какая
  // страница таблицы открыта сейчас.
  const [scan, setScan] = useState<CatalogScan | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchProducts = useCallback(() => {
    if (!currentSeller) return;
    setIsLoading(true);
    kaspiApi
      // archived=true — иначе товары, пропавшие из Kaspi, не найти поиском,
      // хотя продажи по ним в отчётах остаются и себестоимость для них нужна.
      .listProducts(currentSeller.id, { page, limit: COST_PAGE_LIMIT, search: search || undefined, archived: 'true' })
      .then((res) => {
        setProducts(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Не удалось загрузить товары')))
      .finally(() => setIsLoading(false));
  }, [currentSeller, page, search]);

  const fetchScan = useCallback(() => {
    if (!currentSeller) {
      setScan(null);
      return;
    }
    scanCatalog(currentSeller.id, search)
      .then(setScan)
      .catch(() => setScan(null));
  }, [currentSeller, search]);

  useEffect(() => {
    const handle = setTimeout(fetchProducts, 250);
    return () => clearTimeout(handle);
  }, [fetchProducts]);

  useEffect(() => {
    const handle = setTimeout(fetchScan, 250);
    return () => clearTimeout(handle);
  }, [fetchScan]);

  // Полоса готовности наверху страницы берёт покрытие себестоимости отсюда —
  // но только без активного поиска, иначе процент считался бы по фильтру.
  useEffect(() => {
    if (search) return;
    onCoverageChange(scan ? { total: scan.scanned, filled: scan.scanned - scan.missing.length } : null);
  }, [scan, search, onCoverageChange]);

  // Показываем реально применённый процент, а не всегда 60 — иначе повторное
  // нажатие «Применить» молча откатывало бы ранее выставленную ставку.
  useEffect(() => {
    if (percentTouched.current || !scan) return;
    setBulkPercent(String(scan.medianCostPercent ?? 60));
  }, [scan]);

  const missingCount = scan?.missing.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / COST_PAGE_LIMIT));

  /**
   * Сохраняет себестоимость суммой в тенге. Пустое поле снимает значение
   * (costPrice: null), а не сохраняет ноль — иначе товар выглядел бы как
   * заполненный со 100% маржой. Скан каталога правим тут же, чтобы полоса
   * «Аналитика готова на N%» пересчиталась сразу и по всему каталогу.
   */
  const handleSaveCost = async (product: Product, raw: string) => {
    if (!currentSeller) return;
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    if (value === product.costPrice) return;
    try {
      const updated = await kaspiApi.updateProduct(currentSeller.id, product.sku, { costPrice: value });
      setProducts((prev) => prev.map((p) => (p.sku === product.sku ? { ...p, costPrice: updated.costPrice } : p)));
      setScan((prev) => {
        if (!prev) return prev;
        const without = prev.missing.filter((p) => p.sku !== product.sku);
        return {
          ...prev,
          missing: updated.costPrice == null ? [...without, { ...product, costPrice: null }] : without,
        };
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить себестоимость'));
    }
  };

  /**
   * Проставляет себестоимость как процент от цены продажи каждого SKU —
   * считает сам бэкенд (POST products/cost/bulk-percent). `onlyUnfilled=false`
   * перезаписывает и уже заполненные товары.
   */
  const applyBulkPercent = async (onlyUnfilled: boolean) => {
    if (!currentSeller) return;
    const pct = Number(bulkPercent);
    if (!bulkPercent || Number.isNaN(pct) || pct <= 0 || pct >= 100) return;
    setIsBulkSaving(true);
    setError(null);
    setBulkInfo(null);
    try {
      const res = await analyticsApi.bulkCostPercent(currentSeller.id, { percent: pct, onlyUnfilled });
      setBulkInfo(`Заполнено ${res.updated} товаров: себестоимость ${res.percent}% от цены, прибыль ${100 - res.percent}%`);
      fetchProducts();
      fetchScan();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось применить массовое обновление'));
    } finally {
      setIsBulkSaving(false);
    }
  };

  if (!currentSeller) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        Подключите магазин Kaspi (шаг 1), чтобы редактировать себестоимость товаров.
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <StepBadge n={3} ok={missingCount === 0 && !!scan && scan.scanned > 0} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Себестоимость товаров</span>
        <span
          style={{
            fontSize: 10.5,
            background: missingCount === 0 ? '#E1F5EE' : '#FAEEDA',
            color: missingCount === 0 ? '#085041' : '#854F0B',
            padding: '2px 7px',
            borderRadius: 4,
          }}
        >
          {scan ? (missingCount === 0 ? `${scan.scanned} товаров заполнено` : `${missingCount} из ${scan.scanned} не заполнено`) : '…'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <SearchField value={search} onChange={setSearch} />
          <button
            onClick={() => bulkInputRef.current?.focus()}
            style={{ padding: '6px 12px', fontSize: 11.5, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}
          >
            Заполнить все →
          </button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}

      {/* Быстрый старт — оценка себестоимости в процентах от цены (как в прототипе) */}
      <div style={{ background: '#F0F0FF', border: '0.5px solid #AFA9EC', borderRadius: 9, padding: '11px 14px', marginBottom: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 290 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#534AB7', fontWeight: 500 }}>
            ⚡ Быстрый старт: проставить себестоимость как % от цены
            <InfoHint text="Например, при 60% товар за 10 000 ₸ получит себестоимость 6 000 ₸ и прибыль 4 000 ₸. Это грубая оценка — отдельные позиции можно уточнить вручную в таблице ниже." />
          </div>
          {bulkInfo && <div style={{ fontSize: 11, color: '#0F6E56', marginTop: 3 }}>{bulkInfo}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, color: '#666' }}>Закупка ≈</span>
          <input
            ref={bulkInputRef}
            type="number"
            value={bulkPercent}
            onChange={(e) => {
              percentTouched.current = true;
              setBulkPercent(e.target.value);
            }}
            min={1}
            max={99}
            style={{ width: 56, padding: '5px 9px', fontSize: 12.5, fontWeight: 500, border: '0.5px solid rgba(127,119,221,0.4)', borderRadius: 7, textAlign: 'center', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: 11.5, color: '#aaa' }}>% от цены</span>
          <button
            onClick={() => applyBulkPercent(true)}
            disabled={isBulkSaving || missingCount === 0}
            title="Только товары без себестоимости"
            style={{
              padding: '6px 15px',
              fontSize: 12,
              border: 'none',
              borderRadius: 7,
              background: isBulkSaving || missingCount === 0 ? '#C5C1EC' : '#7F77DD',
              color: '#fff',
              cursor: isBulkSaving || missingCount === 0 ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {isBulkSaving ? 'Применяем…' : 'Заполнить пустые'}
          </button>
          <button
            onClick={() => applyBulkPercent(false)}
            disabled={isBulkSaving}
            title="Перезаписать себестоимость у всех товаров"
            style={{
              padding: '6px 15px',
              fontSize: 12,
              border: '0.5px solid rgba(127,119,221,0.4)',
              borderRadius: 7,
              background: '#fff',
              color: '#534AB7',
              cursor: isBulkSaving ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            Ко всем
          </button>
        </div>
      </div>

      <table className="ptable">
        <thead>
          <tr>
            <th style={{ width: '32%' }}>Товар</th>
            <th style={{ textAlign: 'right', width: '13%' }}>Цена продажи</th>
            <th style={{ textAlign: 'center', width: '23%' }}>Себестоимость</th>
            <th style={{ textAlign: 'center', width: '18%' }}>Прибыль с ед.</th>
            <th style={{ textAlign: 'center', width: '14%' }}>Статус</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const filled = p.costPrice != null;
            const unitProfit = filled ? p.priceMin - (p.costPrice as number) : null;
            return (
              <tr key={p.sku} style={{ background: filled ? undefined : '#FFFEF5' }}>
                <td
                  className="sku-name-link"
                  style={{ color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={p.title}
                  onClick={() => setOpenCard({ sku: p.sku, title: p.title })}
                >
                  {p.title}
                  {/* Товар пропал из Kaspi, но продажи по нему в отчётах есть —
                      без пометки непонятно, почему его нет в активном каталоге */}
                  {p.archivedAt && (
                    <span style={{ fontSize: 10, background: '#F1EFE8', color: '#5F5E5A', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                      архивный
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right', color: '#888' }}>{p.priceMin.toLocaleString('ru')} ₸</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    key={`${p.sku}:${p.costPrice ?? ''}`}
                    type="number"
                    min={0}
                    defaultValue={p.costPrice ?? ''}
                    placeholder="Введите…"
                    onBlur={(e) => handleSaveCost(p, e.target.value)}
                    style={{
                      width: 100,
                      padding: '4px 8px',
                      fontSize: 12,
                      border: filled ? '0.5px solid rgba(0,0,0,0.12)' : '0.5px solid #EF9F27',
                      borderRadius: 6,
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      background: filled ? '#fff' : '#FFFEF5',
                    }}
                  />{' '}
                  <span style={{ fontSize: 12, color: '#aaa' }}>₸</span>
                </td>
                <td style={{ textAlign: 'center', color: unitProfit == null ? '#aaa' : unitProfit >= 0 ? '#0F6E56' : '#993C1D', fontWeight: 500 }}>
                  {unitProfit == null ? '—' : `${unitProfit >= 0 ? '+' : ''}${Math.round(unitProfit).toLocaleString('ru')} ₸`}
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {filled ? (
                    <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 4 }}>✓ Заполнено</span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 8px', borderRadius: 4 }}>⚠ Заполнить</span>
                  )}
                  <GearButton onClick={() => setOpenCard({ sku: p.sku, title: p.title })} />
                </td>
              </tr>
            );
          })}
          {!isLoading && products.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: '20px 0' }}>
                Товары не найдены
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: '#888' }}>
        <span>
          {total} товаров · страница {page} из {totalPages}
        </span>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {openCard && currentSeller && (
        <CostHistoryModal
          sellerId={currentSeller.id}
          sku={openCard.sku}
          title={openCard.title}
          onClose={() => setOpenCard(null)}
          // Себестоимость поменялась в истории — таблица и полоса готовности
          // должны показать новое текущее значение, а не то, что было при открытии.
          onChanged={() => {
            fetchProducts();
            fetchScan();
          }}
        />
      )}
    </div>
  );
}

/** Шестерёнка в колонке «Статус» — открывает карточку с историей себестоимости. */
function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="История себестоимости"
      className="sku-gear"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}
