import { useEffect } from 'react';

interface Props {
  title: string;
  count: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Разворот таблицы на весь экран — как в прототипе: тёмный заголовок, крестик, скролл внутри карточки. */
export function ProductsFullscreen({ title, count, onClose, children, footer }: Props) {
  // Escape закрывает, и пока открыт разворот, фон скроллиться не должен.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="prod-fs">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
          {title}
          <span style={{ fontSize: 13, color: '#aaa', fontWeight: 400, marginLeft: 6 }}>{count}</span>
        </span>
        <button className="prod-fs-close" onClick={onClose} title="Закрыть">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="prod-fs-body">{children}</div>
      {footer && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: '#888' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/** Кнопка «развернуть» справа от фильтров. */
export function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn-32" onClick={onClick} title="Развернуть на весь экран">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    </button>
  );
}
