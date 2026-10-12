import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import { InfoHint } from './InfoHint';
import { Modal, StatusBadge, MetricTile } from './Modal';
import type { ProductCard, ProductStatus } from '../types/api';

const fmt = (n: number) => Math.round(n).toLocaleString('ru');

/** «12.03.2026», а для сегодняшнего дня — «сегодня», как в прототипе. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (d.toDateString() === new Date().toDateString()) return 'сегодня';
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusView(card: ProductCard): { tone: 'good' | 'warn' | 'bad'; label: string } {
  if (card.costPrice == null || card.status == null) return { tone: 'warn', label: 'Нет себестоимости' };
  const map: Record<ProductStatus, { tone: 'good' | 'warn' | 'bad'; label: string }> = {
    loss: { tone: 'bad', label: 'Убыточный' },
    low_margin: { tone: 'warn', label: 'Низкая маржа' },
    profitable: { tone: 'good', label: 'Прибыльный' },
  };
  return map[card.status];
}

function Diff({ value }: { value: number | null }) {
  if (value == null || value === 0) return <span style={{ fontSize: 11, color: '#aaa', minWidth: 44, textAlign: 'right' }}>—</span>;
  const up = value > 0;
  return (
    <span style={{ fontSize: 11, color: up ? '#0F6E56' : '#993C1D', minWidth: 44, textAlign: 'right' }}>
      {up ? '+' : '−'}
      {fmt(Math.abs(value))}
    </span>
  );
}

const CurrentTag = () => (
  <span style={{ fontSize: 10, background: '#EEEDFE', color: '#534AB7', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>текущая</span>
);

const SectionTitle = ({ text, hint }: { text: string; hint: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#aaa', marginBottom: 4 }}>
    {text}
    <InfoHint text={hint} />
  </div>
);

const INFO_PRICE = 'История изменения цены продажи по датам. Данные берутся автоматически из Kaspi: цена реальной продажи из заказов и цена на витрине при синхронизации.';
const INFO_COST = 'Ваши закупочные цены по датам. Заказы после даты записи считаются по новой себестоимости, до неё — по предыдущей. Для прибыли с единицы берётся текущая.';

interface Props {
  sellerId: string;
  sku: string;
  /** Название для заголовка, пока карточка грузится. */
  title: string;
  onClose: () => void;
  /** Себестоимость изменилась — таблице и полосе готовности пора обновиться. */
  onChanged?: () => void;
}

/**
 * Карточка товара из «Настроек»: текущая цена и прибыль, история цены продажи
 * и редактируемая история себестоимости.
 */
export function CostHistoryModal({ sellerId, sku, title, onClose, onChanged }: Props) {
  const [card, setCard] = useState<ProductCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [newCost, setNewCost] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .getProductCard(sellerId, sku)
      .then((c) => {
        if (!cancelled) setCard(c);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Не удалось загрузить карточку товара'));
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, sku]);

  /** Все правки возвращают свежую карточку — просто подменяем её. */
  const apply = useCallback(
    async (op: () => Promise<ProductCard>) => {
      setIsBusy(true);
      setError(null);
      try {
        setCard(await op());
        onChanged?.();
        return true;
      } catch (err) {
        setError(extractErrorMessage(err, 'Не удалось сохранить изменения'));
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [onChanged],
  );

  const parseCost = (raw: string): number | null => {
    const v = Number(raw.replace(/\s/g, ''));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseCost(newCost);
    if (cost == null) return;
    if (await apply(() => analyticsApi.addCostEntry(sellerId, sku, { cost }))) setNewCost('');
  };

  const handleSaveEdit = async (entryId: string) => {
    const cost = parseCost(editValue);
    if (cost == null) return;
    if (await apply(() => analyticsApi.updateCostEntry(sellerId, sku, entryId, { cost }))) setEditId(null);
  };

  const handleDelete = (entryId: string) => apply(() => analyticsApi.deleteCostEntry(sellerId, sku, entryId));

  const st = card ? statusView(card) : null;
  const profitColor = card?.unitProfit == null ? '#aaa' : card.unitProfit < 0 ? '#993C1D' : '#0F6E56';

  return (
    <Modal title={card?.title ?? title} badge={st && <StatusBadge tone={st.tone}>{st.label}</StatusBadge>} onClose={onClose} maxWidth={520}>
      {error && <div className="auth-error">{error}</div>}
      {!card ? (
        <div style={{ fontSize: 12, color: '#aaa', padding: '20px 0', textAlign: 'center' }}>{error ? '' : 'Загружаем карточку…'}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <MetricTile label="Текущая цена" value={card.listedPrice != null ? `${fmt(card.listedPrice)} ₸` : '—'} />
            <MetricTile
              label="Прибыль с единицы"
              value={card.unitProfit == null ? '—' : `${card.unitProfit >= 0 ? '+' : '−'}${fmt(Math.abs(card.unitProfit))} ₸`}
              sub={`маржа ${card.marginPct != null ? `${Math.round(card.marginPct)}%` : '—'}`}
              color={profitColor}
            />
          </div>

          <SectionTitle text="История цены продажи" hint={INFO_PRICE} />
          <div style={{ background: '#FAFAFA', borderRadius: 10, padding: '6px 14px', marginBottom: 16 }}>
            {card.priceHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: '#aaa', padding: '7px 0' }}>Цена ещё не наблюдалась — появится после синхронизации</div>
            ) : (
              card.priceHistory.map((h, i, arr) => (
                <div
                  key={`${h.observedAt}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < arr.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : undefined }}
                >
                  <span style={{ fontSize: 12, color: h.isCurrent ? '#1a1a1a' : '#888' }}>
                    {fmtDate(h.observedAt)}
                    {h.isCurrent && <CurrentTag />}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: h.isCurrent ? 600 : 400, color: '#1a1a1a' }}>{fmt(h.price)} ₸</span>
                    <Diff value={h.changeFromPrev} />
                  </span>
                </div>
              ))
            )}
          </div>

          <SectionTitle text="История себестоимости" hint={INFO_COST} />
          <div style={{ background: '#FAFAFA', borderRadius: 10, padding: '6px 14px', marginBottom: 28 }}>
            {card.costHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: '#aaa', padding: '7px 0' }}>Себестоимость ещё не задана</div>
            ) : (
              card.costHistory.map((h, i, arr) => {
                const border = i < arr.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : undefined;
                if (editId === h.id) {
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: border }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{fmtDate(h.effectiveFrom)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(h.id);
                            if (e.key === 'Escape') setEditId(null);
                          }}
                          autoFocus
                          style={{ width: 90, padding: '5px 8px', fontSize: 12.5, border: '0.5px solid #7F77DD', borderRadius: 6, textAlign: 'right', fontFamily: 'inherit', outline: 'none' }}
                        />
                        <span style={{ fontSize: 12, color: '#888' }}>₸</span>
                        <IconButton title="Сохранить" onClick={() => handleSaveEdit(h.id)} disabled={isBusy} filled>
                          <path d="M20 6 9 17l-5-5" />
                        </IconButton>
                        <IconButton title="Отмена" onClick={() => setEditId(null)} bordered>
                          <path d="M18 6 6 18M6 6l12 12" />
                        </IconButton>
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: border }}>
                    <span style={{ fontSize: 12, color: h.isCurrent ? '#1a1a1a' : '#888' }}>
                      {fmtDate(h.effectiveFrom)}
                      {h.isCurrent && <CurrentTag />}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: h.isCurrent ? 600 : 400, color: '#1a1a1a' }}>{fmt(h.cost)} ₸</span>
                      <Diff value={h.changeFromPrev} />
                      <IconButton
                        title="Изменить"
                        onClick={() => {
                          setEditId(h.id);
                          setEditValue(String(h.cost));
                        }}
                        disabled={isBusy}
                        color="#888"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </IconButton>
                      <IconButton title="Удалить" onClick={() => handleDelete(h.id)} disabled={isBusy} color="#B4533A" hoverBg="#FAECE7">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </IconButton>
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              placeholder="Новая себестоимость"
              style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '0.5px solid rgba(127,119,221,0.4)', borderRadius: 9, fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={isBusy || parseCost(newCost) == null}
              className="qs-btn-primary"
              style={{ padding: '9px 18px', fontSize: 13, borderRadius: 9 }}
            >
              {isBusy ? 'Сохраняем…' : 'Добавить'}
            </button>
          </form>
          <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 8, lineHeight: 1.5 }}>
            Новая запись действует с сегодняшнего дня. Прошлые продажи остаются на прежней себестоимости.
          </div>
        </>
      )}
    </Modal>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
  color = '#777',
  filled = false,
  bordered = false,
  hoverBg = '#f2f2f2',
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  color?: string;
  filled?: boolean;
  bordered?: boolean;
  hoverBg?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        border: bordered ? '0.5px solid rgba(0,0,0,0.12)' : 'none',
        borderRadius: 6,
        background: filled ? '#7F77DD' : hover ? hoverBg : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={filled ? '#fff' : color} strokeWidth={filled ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
