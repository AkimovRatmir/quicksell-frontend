import { Modal, StatusBadge, MetricTile } from './Modal';
import type { ProductSales } from '../types/api';

const fmt = (n: number) => Math.abs(Math.round(n)).toLocaleString('ru');
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(n)} ₸`;

/** Порог, ниже которого маржа считается низкой — как в бейджах таблицы. */
const LOW_MARGIN_PCT = 10;
/** Возвраты выше этого — уже проблема, а не шум. */
const RETURNS_ALERT_PCT = 5;

function statusOf(r: ProductSales): { tone: 'good' | 'warn' | 'bad'; label: string } {
  if (r.costMissing) return { tone: 'warn', label: 'Нет себестоимости' };
  if (r.profit < 0) return { tone: 'bad', label: 'Убыточный' };
  if ((r.marginPct ?? 0) < LOW_MARGIN_PCT) return { tone: 'warn', label: 'Низкая маржа' };
  return { tone: 'good', label: 'Прибыльный' };
}

function trendView(t: number | null): { text: string; color: string } {
  if (t == null) return { text: '—', color: '#aaa' };
  if (t > 0) return { text: `▲ +${t}%`, color: '#0F6E56' };
  if (t < 0) return { text: `▼ −${Math.abs(t)}%`, color: '#993C1D' };
  return { text: '→ 0%', color: '#555' };
}

interface Props {
  row: ProductSales;
  /** «за 30 дней» — чтобы подписи «за период» не были абстрактными. */
  periodLabel: string;
  onClose: () => void;
}

/**
 * Показатели товара в отдельном виджете — те же цифры, что в строке таблицы,
 * но крупно и с подписями. Открывается кликом по строке.
 */
export function ProductDetailModal({ row, periodLabel, onClose }: Props) {
  const st = statusOf(row);
  // Цена и прибыль с единицы — производные от периода: выручка и прибыль,
  // делённые на проданное. Без продаж делить не на что.
  const unitPrice = row.units > 0 ? row.revenue / row.units : null;
  const unitProfit = row.units > 0 ? row.profit / row.units : null;
  const profitColor = row.profit > 0 ? '#0F6E56' : row.profit < 0 ? '#993C1D' : '#854F0B';
  const returnsHigh = (row.returnsPct ?? 0) > RETURNS_ALERT_PCT;
  const trend = trendView(row.trendPct);

  return (
    <Modal title={row.title} badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>} onClose={onClose} maxWidth={560}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile label="Цена продажи" value={unitPrice != null ? `${fmt(unitPrice)} ₸` : '—'} sub="за единицу" />
        <MetricTile
          label="Прибыль с единицы"
          value={unitProfit != null ? signed(unitProfit) : '—'}
          sub={`маржа ${row.marginPct != null ? `${Math.round(row.marginPct)}%` : '—'}`}
          color={unitProfit == null ? '#aaa' : profitColor}
        />
        <MetricTile label="Продаж за период" value={`${row.units} шт`} sub={periodLabel} />
        <MetricTile label="Выручка" value={`${fmt(row.revenue)} ₸`} />
        <MetricTile label="Прибыль" value={signed(row.profit)} color={profitColor} />
        <MetricTile label="Доля в прибыли" value={row.profitSharePct != null ? `${Math.round(row.profitSharePct)}%` : '—'} />
        <MetricTile
          label="Возвраты"
          value={row.returnsPct != null ? `${row.returnsPct.toFixed(1)}%` : '—'}
          sub={row.returnsPct == null ? undefined : returnsHigh ? 'выше нормы' : 'в норме'}
          color={returnsHigh ? '#993C1D' : '#1a1a1a'}
        />
        <MetricTile label="Тренд" value={trend.text} sub="к прошлому периоду" color={trend.color} />
      </div>
      {row.costMissing && (
        <div style={{ fontSize: 11, color: '#854F0B', background: '#FAEEDA', borderRadius: 8, padding: '8px 10px', marginTop: 12, lineHeight: 1.5 }}>
          Себестоимость не заполнена — прибыль и маржа посчитаны без неё и завышены. Заполнить можно в «Настройках».
        </div>
      )}
    </Modal>
  );
}
