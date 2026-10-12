import { useEffect } from 'react';

interface ModalProps {
  title: string;
  /** Бейдж под заголовком — статус товара и т.п. */
  badge?: React.ReactNode;
  onClose: () => void;
  maxWidth?: number;
  children: React.ReactNode;
}

/**
 * Модалка из прототипа: затемнение с блюром, белая карточка со скруглением 16,
 * заголовок с крестиком. Закрывается кликом по фону и Escape.
 */
export function Modal({ title, badge, onClose, maxWidth = 520, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Фон под модалкой не должен прокручиваться вместе с ней.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="qs-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qs-modal-card" style={{ maxWidth }}>
        <div className="qs-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="qs-modal-title" title={title}>
              {title}
            </div>
            {badge && <div style={{ marginTop: 6 }}>{badge}</div>}
          </div>
          <button className="qs-modal-close" onClick={onClose} title="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="qs-modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Цветной бейдж статуса под заголовком модалки. */
export function StatusBadge({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const c = {
    good: { bg: '#E1F5EE', color: '#085041' },
    warn: { bg: '#FAEEDA', color: '#854F0B' },
    bad: { bg: '#FAECE7', color: '#712B13' },
    neutral: { bg: '#EEEDFE', color: '#534AB7' },
  }[tone];
  return <span style={{ fontSize: 11, background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 6 }}>{children}</span>;
}

/** Плитка-метрика: подпись, значение, подстрочник. */
export function MetricTile({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: '#FAFAFA', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? '#1a1a1a', letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
