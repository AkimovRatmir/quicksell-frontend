import type { ProductSales } from '../types/api';
import { LockGlyph } from '../context/UpgradeContext';

const COLUMNS: { label: string; width: string; align: 'left' | 'right' | 'center' }[] = [
  { label: 'Товар', width: '24%', align: 'left' },
  { label: 'Продаж', width: '9%', align: 'right' },
  { label: 'Выручка', width: '14%', align: 'right' },
  { label: 'Прибыль', width: '14%', align: 'right' },
  { label: 'Доля в прибыли', width: '17%', align: 'center' },
  { label: 'Маржа', width: '9%', align: 'right' },
  { label: 'Возвр.', width: '8%', align: 'right' },
  { label: 'Тренд', width: '10%', align: 'center' },
];

export const PRODUCT_COLUMN_COUNT = COLUMNS.length;

const tenge = (v: number) => `${Math.abs(Math.round(v)).toLocaleString('ru')} ₸`;

function marginTone(margin: number): { bg: string; color: string } {
  if (margin >= 25) return { bg: '#E1F5EE', color: '#085041' };
  if (margin >= 10) return { bg: '#F1EFE8', color: '#5F5E5A' };
  return { bg: '#FAECE7', color: '#712B13' };
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin == null) return <span style={{ color: '#ccc', fontSize: 12 }}>—</span>;
  const tone = marginTone(margin);
  return (
    <span style={{ fontSize: 12, background: tone.bg, color: tone.color, padding: '2px 8px', borderRadius: 5 }}>
      {Math.round(margin)}%
    </span>
  );
}

function Trend({ value }: { value: number | null }) {
  // Прочерк, а не «0%»: отсутствие сравнения и нулевое изменение — разные вещи.
  if (value == null) return <span style={{ color: '#ccc' }}>—</span>;
  if (value === 0) return <span style={{ color: '#555' }}>→ 0%</span>;
  const up = value > 0;
  return (
    <span style={{ color: up ? '#0F6E56' : '#993C1D' }}>
      {up ? '▲ +' : '▼ −'}
      {Math.abs(value)}%
    </span>
  );
}

interface Props {
  rows: ProductSales[];
  /** Строки под замком на бесплатном тарифе — показываем точками. */
  lockedRows?: ProductSales[];
  /** Крупный режим для полного экрана: те же колонки, больше воздуха. */
  big?: boolean;
  emptyText?: string;
  /** Клик по строке — открыть показатели товара отдельным виджетом. */
  onRowClick?: (row: ProductSales) => void;
  children?: React.ReactNode;
}

/** Таблица товарной статистики: продажи, выручка и прибыль по каждому SKU. */
export function ProductsTable({ rows, lockedRows = [], big = false, emptyText, onRowClick, children }: Props) {
  const cellPad = big ? '12px 8px' : '9px 8px';
  const headPad = big ? '11px 8px' : '7px 8px';
  const fontSize = big ? 13.5 : 13;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize, tableLayout: 'fixed' }}>
      <thead>
        <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          {COLUMNS.map((c) => (
            <th
              key={c.label}
              style={{
                textAlign: c.align,
                padding: headPad,
                fontSize: 11.5,
                fontWeight: 500,
                color: '#aaa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: c.width,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const share = r.profitSharePct ?? 0;
          const profitColor = r.profit > 0 ? '#0F6E56' : r.profit < 0 ? '#993C1D' : '#854F0B';
          // Бэкенд подставляет SKU вместо названия, когда карточки товара нет
          // в каталоге. Совет «заполните себестоимость» тут бесполезен —
          // сначала товар должен появиться в каталоге.
          const notInCatalog = r.title === r.sku;
          const warnTitle = notInCatalog
            ? `${r.sku}\nТовара нет в каталоге: он снят с продажи в Kaspi или не подтянулся синхронизацией.\nПродажи по нему учтены, но себестоимость взять неоткуда — прибыль завышена.`
            : `${r.title}\nСебестоимость не заполнена — прибыль и маржа неполные`;
          return (
            <tr
              key={r.sku}
              className={onRowClick ? 'prod-row-click' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{
                borderBottom: '0.5px solid rgba(0,0,0,0.04)',
                background: r.profit < 0 ? '#FFF8F6' : undefined,
              }}
            >
              <td
                style={{
                  padding: cellPad,
                  fontSize,
                  color: r.profit < 0 ? '#993C1D' : '#1a1a1a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                // Названия длинные и обрезаются — полное показываем подсказкой.
                title={r.costMissing ? warnTitle : r.title}
              >
                {r.title}
                {notInCatalog ? (
                  <span style={{ fontSize: 10, background: '#FAECE7', color: '#993C1D', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                    ⚠ нет в каталоге
                  </span>
                ) : (
                  r.costMissing && <span style={{ color: '#EF9F27', marginLeft: 5 }}>⚠</span>
                )}
              </td>
              <td style={{ textAlign: 'right', padding: cellPad, color: '#555', fontSize }}>{r.units}</td>
              <td style={{ textAlign: 'right', padding: cellPad, color: '#555', fontSize }}>{tenge(r.revenue)}</td>
              <td style={{ textAlign: 'right', padding: cellPad, color: profitColor, fontWeight: 500, fontSize }}>
                {r.profit >= 0 ? '+' : '−'}
                {tenge(r.profit)}
              </td>
              <td style={{ padding: cellPad }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, share))}%`, height: '100%', background: '#7F77DD', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#534AB7', minWidth: 28, textAlign: 'right' }}>{Math.round(share)}%</span>
                </div>
              </td>
              <td style={{ textAlign: 'right', padding: cellPad }}>
                <MarginBadge margin={r.marginPct} />
              </td>
              <td style={{ textAlign: 'right', padding: cellPad, color: (r.returnsPct ?? 0) > 5 ? '#993C1D' : '#555', fontSize }}>
                {r.returnsPct == null ? '—' : `${r.returnsPct.toFixed(1)}%`}
              </td>
              <td style={{ textAlign: 'center', padding: cellPad, fontSize: 12 }}>
                <Trend value={r.trendPct} />
              </td>
            </tr>
          );
        })}

        {lockedRows.map((r) => (
          <tr key={r.sku} className="locked-row" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
            <td style={{ padding: cellPad, fontSize }}>
              <span className="mini-lock">
                <LockGlyph size={12} strokeWidth={2} color="currentColor" />
                {r.title}
              </span>
            </td>
            <td style={{ textAlign: 'right', padding: cellPad, fontSize }}>•••</td>
            <td style={{ textAlign: 'right', padding: cellPad, fontSize }}>••• ₸</td>
            <td className="prof-cell" style={{ textAlign: 'right', padding: cellPad, fontWeight: 500, fontSize }}>
              ••• ₸
            </td>
            <td style={{ padding: cellPad }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div className="sharebar-fill" style={{ width: '12%', height: '100%', borderRadius: 3 }} />
                </div>
                <span className="share-pct-c" style={{ fontSize: 11, minWidth: 28, textAlign: 'right' }}>
                  ••
                </span>
              </div>
            </td>
            <td style={{ textAlign: 'right', padding: cellPad }}>
              <span className="mbadge" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 5 }}>
                ••%
              </span>
            </td>
            <td style={{ textAlign: 'right', padding: cellPad, fontSize }}>••</td>
            <td style={{ textAlign: 'center', padding: cellPad, fontSize: 12 }}>••</td>
          </tr>
        ))}

        {children}

        {rows.length === 0 && lockedRows.length === 0 && emptyText && (
          <tr>
            <td colSpan={COLUMNS.length} style={{ textAlign: 'center', color: '#aaa', padding: '24px 0' }}>
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
