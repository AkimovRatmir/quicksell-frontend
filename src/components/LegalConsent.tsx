import type { ReactNode } from 'react';

/** Юридические документы. Лежат в public/docs — отдаются как есть, без бэкенда. */
export const LEGAL_DOCS = {
  oferta: { href: '/docs/oferta_quicksell.pdf', title: 'Публичная оферта' },
  policy: { href: '/docs/policy_quicksell.pdf', title: 'Политика конфиденциальности' },
  payment: { href: '/docs/payment_quicksell.pdf', title: 'Процедура оплаты' },
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;

/** Ссылка на документ — открывается в новой вкладке, чтобы не терять заполненную форму. */
export function LegalLink({ doc, children }: { doc: LegalDoc; children?: ReactNode }) {
  const { href, title } = LEGAL_DOCS[doc];
  return (
    <a className="consent-link" href={href} target="_blank" rel="noopener noreferrer">
      {children ?? title}
    </a>
  );
}

/**
 * Чекбокс согласия. Никогда не проставлен заранее — предотмеченная галочка
 * не считается действительным согласием, пользователь ставит её сам.
 * `invalid` — подсветка, когда попытались продолжить без галочки.
 */
export function ConsentCheck({
  id,
  checked,
  onChange,
  invalid,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className={`consent${invalid ? ' is-invalid' : ''}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Текст согласия при регистрации — один на все тарифы. */
export function RegistrationConsentText() {
  return (
    <>
      Я принимаю условия <LegalLink doc="oferta">Публичной оферты</LegalLink> и даю согласие на обработку моих персональных данных
      в соответствии с <LegalLink doc="policy">Политикой конфиденциальности</LegalLink>.
    </>
  );
}

/** Текст согласия при оплате подписки — дополнительно к регистрационному. */
export function SubscriptionConsentText() {
  return (
    <>
      Я ознакомлен и согласен с <LegalLink doc="oferta">Публичной офертой</LegalLink> и{' '}
      <LegalLink doc="payment">Процедурой оплаты</LegalLink> и подтверждаю согласие на ежемесячное автоматическое списание стоимости
      подписки до момента её отмены.
    </>
  );
}
