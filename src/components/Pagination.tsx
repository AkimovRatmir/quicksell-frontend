interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Builds a compact page list with 1-based ellipses, e.g. 1 … 4 5 [6] 7 8 … 20. */
function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('gap');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('gap');
  items.push(totalPages);
  return items;
}

/** Classic numbered page switcher: ‹ 1 2 3 … N ›. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = pageItems(page, totalPages);
  const arrow = (dir: -1 | 1, disabled: boolean) => (
    <button
      onClick={() => onPageChange(page + dir)}
      disabled={disabled}
      style={{
        minWidth: 26,
        height: 26,
        padding: '0 6px',
        borderRadius: 6,
        border: '0.5px solid rgba(0,0,0,0.12)',
        background: '#fff',
        color: disabled ? '#ccc' : '#555',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        fontSize: 12,
      }}
    >
      {dir === -1 ? '‹' : '›'}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {arrow(-1, page <= 1)}
      {items.map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} style={{ minWidth: 20, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            style={{
              minWidth: 26,
              height: 26,
              padding: '0 6px',
              borderRadius: 6,
              border: item === page ? 'none' : '0.5px solid rgba(0,0,0,0.12)',
              background: item === page ? '#1F1F1F' : '#fff',
              color: item === page ? '#fff' : '#555',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: item === page ? 500 : 400,
            }}
          >
            {item}
          </button>
        ),
      )}
      {arrow(1, page >= totalPages)}
    </div>
  );
}
