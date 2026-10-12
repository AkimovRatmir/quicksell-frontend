import { useEffect, useRef, useState } from 'react';
import { IconCheck } from '../components/Icons';
import { useIsFree } from '../components/Pro';
import { ConsentCheck, SubscriptionConsentText } from '../components/LegalConsent';
import { legalApi } from '../api/legal';
import { billingApi, PAYMENT_RETURN_MESSAGE } from '../api/billing';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PaymentInfo } from '../types/api';
import visaLogo from '../assets/payment/visa.svg';
import mastercardLogo from '../assets/payment/mastercard.svg';

/** 28.10.2026 */
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU');
}

/**
 * Тарифы по модели Freemium: Free навсегда, Pro за 15 000 ₸/мес.
 * План и дата окончания Pro приходят из GET /auth/me. Оплата — через
 * FreedomPay, в попапе поверх страницы (см. CheckoutModal).
 */
export function TariffPage() {
  const isFree = useIsFree();
  const { user } = useAuth();
  const proUntil = !isFree && user?.planExpiresAt ? formatDay(user.planExpiresAt) : null;
  // Согласие на оферту, процедуру оплаты и автосписание запрашивается в
  // отдельном шаге по клику «Перейти на Pro», а не висит в карточке тарифа.
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <div>
      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
      {/* Текущий статус */}
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderRadius: 10,
          border: '0.5px solid rgba(0,0,0,0.07)',
          padding: '12px 18px',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>Ваш тариф</span>
          <span
            style={{
              fontSize: 10.5,
              background: isFree ? '#EEEDFE' : '#E1F5EE',
              color: isFree ? '#3C3489' : '#085041',
              padding: '2px 8px',
              borderRadius: 5,
            }}
          >
            {isFree ? 'Free' : 'Pro'}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {isFree
              ? 'Чтобы получить детальную аналитику и AI советы переходите на PRO'
              : proUntil
                ? `Полный доступ до ${proUntil}, спасибо, что с нами!`
                : 'Полный доступ активен, спасибо, что с нами!'}
          </span>
        </div>
      </div>

      {/* Две карточки по центру */}
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
        {/* FREE */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.09)', padding: 28, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Free</div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#1a1a1a', marginTop: 12 }}>
            0 ₸<span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}> / навсегда</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#999', marginTop: 6 }}>Базовая аналитика магазина без ограничений по времени</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '22px 0', flex: 1 }}>
            <PlanFeature text="Выручка, прибыль и маржа" />
            <PlanFeature text="Заказы и структура выручки" />
            <PlanFeature text="Товарная статистика (топ-товары скрыты)" />
            <PlanFeature text="Точки роста, расходы, AI-советы" off />
          </div>
          <button
            disabled
            style={{
              width: '100%',
              padding: 11,
              borderRadius: 9,
              border: '0.5px solid rgba(0,0,0,0.12)',
              background: '#fafafa',
              color: '#888',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: isFree ? 'default' : 'not-allowed',
              opacity: isFree ? 1 : 0.55,
            }}
          >
            {isFree ? 'Текущий тариф' : '—'}
          </button>
        </div>

        {/* PRO */}
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            border: '1.5px solid #7F77DD',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 16px 48px -20px rgba(127,119,221,0.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10.5,
              fontWeight: 500,
              background: '#7F77DD',
              color: '#fff',
              padding: '3px 14px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            Полный доступ
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#534AB7' }}>Pro</div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#1a1a1a', marginTop: 12 }}>
            15 000 ₸<span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}> / мес</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#999', marginTop: 6 }}>Всё из Free + инструменты для принятия правильных решений</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '22px 0', flex: 1 }}>
            <PlanFeature text="Все товары и топ-позиции без ограничений" />
            <PlanFeature text="Расходы по статьям и точки роста" />
            <PlanFeature text="Калькулятор юнит-экономики" />
            <PlanFeature text="AI-рекомендации для решений" />
          </div>
          {isFree ? (
            <button className="qs-btn-primary" style={{ width: '100%', padding: 11, borderRadius: 9, fontSize: 13 }} onClick={() => setCheckoutOpen(true)}>
              Перейти на Pro
            </button>
          ) : (
            <button
              disabled
              style={{
                width: '100%',
                padding: 11,
                borderRadius: 9,
                border: 'none',
                background: '#EEEDFE',
                color: '#534AB7',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'default',
              }}
            >
              Текущий тариф
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type CheckoutStep =
  | { kind: 'terms' }
  | { kind: 'pay'; paymentId: string; paymentUrl: string }
  | { kind: 'done'; paidUntil: string | null }
  | { kind: 'failed'; reason: string | null };

/**
 * Оплата Pro в три шага, не уходя со страницы:
 * 1. Тариф и согласие с офертой, процедурой оплаты и автосписанием.
 *    Галочка не предотмечена, согласие записываем по клику «Оплатить».
 * 2. Форма FreedomPay во фрейме поверх страницы — карту вводят у них,
 *    к нам данные карты не попадают.
 * 3. Итог. Его узнаём только у бэкенда (он сверяется с FreedomPay),
 *    а не из того, что показал фрейм.
 */
function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<CheckoutStep>({ kind: 'terms' });
  const [accepted, setAccepted] = useState(false);
  const [missing, setMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Закрыли посреди оплаты: платёж мог успеть пройти — тогда тариф освежится.
  const close = () => {
    if (step.kind === 'pay') {
      billingApi
        .payment(step.paymentId)
        .then((p) => (p.status === 'paid' ? refreshUser() : undefined))
        .catch(() => undefined);
    }
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handlePay = async () => {
    if (!accepted) {
      setMissing(true);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // Согласие фиксируем в момент подтверждения подписки, а не когда
      // щёлкнули галочку. Без записи согласия бэкенд платёж не создаст.
      await legalApi.acceptConsents('subscription');
      const created = await billingApi.checkout();
      setStep({ kind: 'pay', paymentId: created.paymentId, paymentUrl: created.paymentUrl });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось начать оплату. Попробуйте ещё раз.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (step.kind === 'pay') {
    return (
      <PaymentStep
        paymentId={step.paymentId}
        paymentUrl={step.paymentUrl}
        onClose={close}
        onResult={(p) => {
          if (p.status === 'paid') {
            setStep({ kind: 'done', paidUntil: p.paidUntil });
            refreshUser().catch(() => undefined);
          } else {
            setStep({ kind: 'failed', reason: p.failureReason });
          }
        }}
      />
    );
  }

  if (step.kind === 'done' || step.kind === 'failed') {
    const ok = step.kind === 'done';
    return (
      <div
        className="upgrade-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="um-card">
          <div className={`pay-result-icon${ok ? '' : ' is-bad'}`}>{ok ? '✓' : '!'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginTop: 14 }}>
            {ok ? 'Pro подключён' : 'Оплата не прошла'}
          </div>
          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: '8px 0 20px' }}>
            {ok
              ? step.paidUntil
                ? `Полный доступ открыт до ${formatDay(step.paidUntil)}. Спасибо!`
                : 'Полный доступ открыт. Спасибо!'
              : failureText(step.reason)}
          </div>
          {ok ? (
            <button className="um-btn" onClick={close}>
              Отлично
            </button>
          ) : (
            <>
              <button className="um-btn" onClick={() => setStep({ kind: 'terms' })}>
                Попробовать снова
              </button>
              <button className="um-close" onClick={close} style={{ display: 'block', margin: '10px auto 0' }}>
                Закрыть
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="upgrade-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="um-card" style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#534AB7' }}>Подписка Pro</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: '#1a1a1a' }}>15 000 ₸</span>
          <span style={{ fontSize: 13, color: '#aaa' }}>/ мес</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#888', lineHeight: 1.6, marginTop: 4 }}>
          Списывается ежемесячно с банковской карты. Отменить можно в любой момент доступ сохранится до конца оплаченного периода.
        </div>

        {/* Условия и принимаемые карты — один блок: карты относятся к тому же
            согласию. Ниже разделитель, отделяющий его от кнопки оплаты. */}
        <div className="checkout-terms">
          <ConsentCheck
            id="checkout-billing"
            checked={accepted}
            invalid={missing && !accepted}
            onChange={(v) => {
              setAccepted(v);
              if (v) setMissing(false);
            }}
          >
            <SubscriptionConsentText />
          </ConsentCheck>
          <div className="checkout-cards">
            <img src={visaLogo} alt="Visa" height={13} />
            <img src={mastercardLogo} alt="Mastercard" height={20} />
          </div>
        </div>
        <div className="checkout-div" />

        {error && (
          <div className="auth-error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}

        <button className="um-btn" onClick={handlePay} disabled={isSaving}>
          {isSaving ? 'Подождите…' : 'Оплатить 15 000 ₸'}
        </button>
        <button className="um-close" onClick={onClose} style={{ display: 'block', margin: '10px auto 0' }}>
          Не сейчас
        </button>
      </div>
    </div>
  );
}

/** Как часто спрашиваем бэкенд, чем кончился платёж. */
const PAYMENT_POLL_MS = 3000;
/** Форма FreedomPay живёт 30 минут — дольше ждать нечего. */
const PAYMENT_POLL_LIMIT_MS = 35 * 60_000;

/** Причину отказа показываем, только если она по-русски (её пишет банк или FreedomPay). */
function failureText(reason: string | null) {
  return reason && /[а-яё]/i.test(reason)
    ? reason
    : 'Банк отклонил платёж или он не был завершён. Деньги не списаны — можно попробовать ещё раз.';
}

/**
 * Форма оплаты FreedomPay во фрейме. Пока она открыта, раз в несколько секунд
 * спрашиваем бэкенд о платеже; страница возврата (/payment/return) внутри
 * фрейма присылает сигнал — тогда спрашиваем сразу.
 *
 * Клик мимо формы попап не закрывает: промахнуться мимо фрейма легко, а
 * закрыть его посреди 3-D Secure — значит бросить оплату. Только крестик.
 */
function PaymentStep({
  paymentId,
  paymentUrl,
  onResult,
  onClose,
}: {
  paymentId: string;
  paymentUrl: string;
  onResult: (payment: PaymentInfo) => void;
  onClose: () => void;
}) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let timer: number | undefined;
    const started = Date.now();

    const check = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      window.clearTimeout(timer);
      try {
        const p = await billingApi.payment(paymentId);
        if (stopped) return;
        if (p.status !== 'pending') {
          stopped = true;
          onResultRef.current(p);
          return;
        }
      } catch {
        // Сеть моргнула — спросим на следующем круге.
      } finally {
        inFlight = false;
      }
      if (!stopped && Date.now() - started < PAYMENT_POLL_LIMIT_MS) {
        timer = window.setTimeout(check, PAYMENT_POLL_MS);
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === PAYMENT_RETURN_MESSAGE) void check();
    };
    window.addEventListener('message', onMessage);
    timer = window.setTimeout(check, PAYMENT_POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
  }, [paymentId]);

  return (
    <div className="upgrade-modal">
      <div className="pay-card">
        <div className="pay-head">
          <div>
            <div className="pay-title">Оплата подписки Pro</div>
            <div className="pay-sub">15 000 ₸ · карта вводится на защищённой форме FreedomPay</div>
          </div>
          <button className="qs-modal-close" onClick={onClose} title="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <iframe className="pay-frame" src={paymentUrl} title="Оплата FreedomPay" allow="payment" />
      </div>
    </div>
  );
}

/** Пункт тарифа. `off` — недоступное на этом плане: серым и с крестиком, как в прототипе. */
function PlanFeature({ text, off = false }: { text: string; off?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: off ? '#bbb' : '#333' }}>
      <span style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2, display: 'inline-flex' }}>
        {off ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <IconCheck />
        )}
      </span>
      {text}
    </div>
  );
}
