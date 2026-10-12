import type { ReactNode } from 'react';
import { LockGlyph, useUpgrade, type UpgradeFeature } from '../context/UpgradeContext';
import { useAuth } from '../context/AuthContext';

/** true — тариф не даёт доступа к платной функции. */
export function useIsFree() {
  return useAuth().plan !== 'pro';
}

export function ProBadge({ small }: { small?: boolean }) {
  const isFree = useIsFree();
  if (!isFree) return null;
  return <span className={small ? 'pro-badge-sm' : 'pro-badge'}>PRO</span>;
}

/**
 * Секция под замком: на free содержимое размывается и поверх ложится оверлей,
 * на pro рендерится как есть. Содержимое всегда в DOM — так видно, что скрыто.
 */
export function LockBlock({
  locked,
  title,
  feature,
  children,
}: {
  locked: boolean;
  /** Подпись на замке. Без неё — только замок и кнопка, а всё содержимое под блюром. */
  title?: string;
  feature: UpgradeFeature;
  children: ReactNode;
}) {
  const { openUpgrade } = useUpgrade();
  if (!locked) return <>{children}</>;
  return (
    <div className="lock-block">
      <div className="lb-content">{children}</div>
      <div className="lb-overlay">
        <div className="lb-lock">
          <LockGlyph />
        </div>
        {title && <div className="lb-title">{title}</div>}
        <button className="lb-btn" onClick={() => openUpgrade(feature)}>
          Открыть
        </button>
      </div>
    </div>
  );
}

/**
 * Карточка целиком под замком: размывается всё, включая заголовок. PRO-бейдж
 * рисуется на оверлее в том же углу, где стоял бы в заголовке.
 * Два вида замка из прототипа: лёгкий (free-hide) и «матовый» (lock-block) —
 * с белой подложкой поверх размытия.
 */
export function LockedCard({
  locked,
  feature,
  header,
  title,
  sub,
  frost,
  children,
  style,
}: {
  locked: boolean;
  feature: UpgradeFeature;
  header: ReactNode;
  /** «Матовый» замок с белой подложкой — как «Точки роста» в прототипе. */
  frost?: boolean;
  /** Заголовок и пояснение на замке — объясняют, что именно скрыто. */
  title?: string;
  sub?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const { openUpgrade } = useUpgrade();
  return (
    <div
      className={`free-hide${locked ? ' is-locked' : ''}${frost ? ' is-frost' : ''}`}
      style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px', ...style }}
    >
      {locked && (
        <div className="free-lock-over" onClick={() => openUpgrade(feature)}>
          <div className="lb-corner-pro">PRO</div>
          <div className="lb-lock">
            <LockGlyph />
          </div>
          {title && <div className="lb-title">{title}</div>}
          {sub && <div className="lb-sub">{sub}</div>}
          <button className="lb-btn">Открыть</button>
        </div>
      )}
      {header}
      {children}
    </div>
  );
}

/** AI-карточка: на free размывается целиком и предлагает апгрейд. */
export function AiCard({ locked, children, style }: { locked: boolean; children: ReactNode; style?: React.CSSProperties }) {
  const { openUpgrade } = useUpgrade();
  return (
    <div className={`qs-ai${locked ? ' is-locked' : ''}`} style={style}>
      {locked && (
        <div className="qs-ai-lock" onClick={() => openUpgrade('ai')}>
          <div className="lb-corner-pro">PRO</div>
          <div className="lb-lock">
            <LockGlyph />
          </div>
          <div className="lb-title">QuickSell AI</div>
          <button className="lb-btn">Открыть</button>
        </div>
      )}
      <div className="qs-ai-body">{children}</div>
    </div>
  );
}
