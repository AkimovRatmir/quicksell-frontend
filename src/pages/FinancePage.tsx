import { useEffect, useState } from 'react';
import { RevenueProfitChart } from '../components/charts/RevenueProfitChart';
import { kaspiApi } from '../api/kaspi';
import { useSeller } from '../context/SellerContext';
import { useAnalytics } from '../lib/useAnalytics';
import { selectionLabel, type PeriodSelection } from '../lib/period';
import { AiCard, LockedCard, ProBadge, useIsFree } from '../components/Pro';
import { AiText } from '../components/AiBits';
import { aiPlaceholder, useAiInsights } from '../context/AiInsightsContext';

// Sellers we've already attempted an on-demand order backfill for this session,
// so navigating back and forth doesn't re-trigger the heavy 89-day pull.
const backfillAttempted = new Set<string>();

const MONTH_ABBR = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function formatMonthLabel(month: string): string {
  const [, m] = month.split('-');
  const idx = Number(m) - 1;
  return MONTH_ABBR[idx] ?? month;
}

interface FinancePageProps {
  selection: PeriodSelection;
}

export function FinancePage({ selection }: FinancePageProps) {
  const { currentSeller } = useSeller();
  const { profit, monthly, isLoading, error, derived, reload } = useAnalytics(currentSeller?.id ?? null, selection);
  const isFree = useIsFree();
  const ai = useAiInsights();
  const aiNote = aiPlaceholder(ai);
  // Total stored orders regardless of period — lets us tell "no orders at all"
  // from "orders exist but none COMPLETED inside the selected window".
  const [storedOrders, setStoredOrders] = useState<number | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  useEffect(() => {
    if (!currentSeller) return;
    kaspiApi
      .listOrders(currentSeller.id, { page: 1, limit: 1 })
      .then((r) => setStoredOrders(r.total))
      .catch(() => setStoredOrders(null));
  }, [currentSeller, profit]);

  // Self-heal: analytics is computed from Kaspi orders, which are pulled by a
  // one-time backfill (gated on the API token captured when the store was
  // connected). If a connected seller has no orders yet, pull them once now,
  // then refresh the numbers. Runs at most once per seller per session.
  useEffect(() => {
    if (!currentSeller) return;
    const sellerId = currentSeller.id;
    // Claim the attempt synchronously so React 18 StrictMode's double-invoke
    // (and quick back-and-forth navigation) can't fire the backfill twice.
    if (backfillAttempted.has(sellerId)) return;
    backfillAttempted.add(sellerId);

    kaspiApi
      .listOrders(sellerId, { page: 1, limit: 1 })
      .then((res) => {
        if (res.total > 0) return;
        setIsBackfilling(true);
        return kaspiApi
          .backfillOrders(sellerId)
          .then((r) => {
            if (r.orders > 0) reload();
          })
          .finally(() => setIsBackfilling(false));
      })
      .catch(() => setIsBackfilling(false));
  }, [currentSeller, reload]);

  if (!currentSeller) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        Сначала подключите магазин Kaspi во вкладке «Настройки».
      </div>
    );
  }

  if (!profit) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        {error ?? (isBackfilling ? 'Загружаем заказы из Kaspi…' : isLoading ? 'Загрузка…' : '—')}
      </div>
    );
  }

  const periodLabel = selectionLabel(selection);
  const maxShare = profit.expensesByCategory.length ? Math.max(...profit.expensesByCategory.map((e) => e.share)) : 1;
  const revenue = profit.revenue;
  const compositionRows: { label: string; color: string; textColor: string; value: number }[] = [
    { label: 'Чистая прибыль', color: '#7F77DD', textColor: '#534AB7', value: profit.composition.netProfit },
    { label: 'Себестоимость', color: '#C5C1EC', textColor: '#666', value: profit.composition.cogs },
    { label: 'Операц. расходы', color: '#F0997B', textColor: '#993C1D', value: profit.composition.operatingExpenses },
  ];
  const topCategory = profit.expensesByCategory.length
    ? profit.expensesByCategory.reduce((a, b) => (b.share > a.share ? b : a))
    : null;

  const monthLabels = monthly?.data.map((d) => formatMonthLabel(d.month)) ?? [];
  const monthRevenue = monthly?.data.map((d) => d.revenue) ?? [];
  const monthProfit = monthly?.data.map((d) => d.profit) ?? [];

  // Orders exist, but the selected period caught no COMPLETED ones → tell the
  // user to widen the window instead of leaving them staring at zeros.
  const monthsWithSales = monthly?.data.filter((d) => d.revenue > 0).length ?? 0;
  const showPeriodHint = revenue === 0 && !isBackfilling && (storedOrders ?? 0) > 0;

  return (
    <div>
      {error && (
        <div style={{ background: '#FAECE7', color: '#993C1D', border: '0.5px solid #F0997B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          {error}
        </div>
      )}
      {isBackfilling && (
        <div style={{ background: '#EEEDFE', color: '#534AB7', border: '0.5px solid #AFA9EC', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          Загружаем заказы из Kaspi — цифры появятся через несколько секунд…
        </div>
      )}
      {derived && (
        <div style={{ background: '#EEEDFE', color: '#534AB7', border: '0.5px solid #AFA9EC', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          Отчёт {periodLabel} — календарная выборка. Разбивка по статьям расходов и счётчики заказов считаются только в режиме «Период».
        </div>
      )}
      {showPeriodHint && (
        <div style={{ background: '#FFFBEB', color: '#854F0B', border: '0.5px solid #F5D98B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          Нет завершённых заказов {periodLabel}, хотя всего у магазина их {storedOrders?.toLocaleString('ru')}.{' '}
          {monthsWithSales > 0
            ? 'Продажи есть в других месяцах — выберите период побольше (напр. «12 мес») сверху справа.'
            : 'Возможно, заказы ещё догружаются, либо среди них нет завершённых.'}
        </div>
      )}

      {/* ROW 1: 4 KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
        <KpiCard label={`Выручка ${periodLabel}`} value={`${revenue.toLocaleString('ru')} ₸`} valueColor="#1a1a1a">
          <Delta pct={profit.comparison.revenuePct} />
          <PrevPeriodHint current={revenue} pct={profit.comparison.revenuePct} />
        </KpiCard>
        <KpiCard label="Чистая прибыль" value={`${profit.netProfit.toLocaleString('ru')} ₸`} valueColor="#0F6E56">
          <Delta pct={profit.comparison.netProfitPct} />
          <PrevPeriodHint current={profit.netProfit} pct={profit.comparison.netProfitPct} />
        </KpiCard>
        <KpiCard label="Расходы" value={`${profit.operatingExpenses.toLocaleString('ru')} ₸`} valueColor="#993C1D">
          <Delta pct={profit.comparison.expensesPct} invert />
          <span style={{ fontSize: 10, color: '#ccc' }}>{profit.expensesShareOfRevenuePct.toFixed(1)}% от выручки</span>
        </KpiCard>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Маржинальность</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#534AB7', letterSpacing: '-0.02em', lineHeight: 1 }}>{profit.marginPct.toFixed(1)}%</div>
          <div style={{ marginTop: 7 }}>
            <div style={{ height: 4, borderRadius: 2, background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, profit.marginPct))}%`, height: '100%', background: '#7F77DD', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: chart + expenses by category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>
              Выручка и прибыль по месяцам
            </span>
            <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: '#888' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#AFA9EC' }} />
                Выручка
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0F6E56' }} />
                Прибыль
              </span>
            </div>
          </div>
          {monthly ? (
            <RevenueProfitChart labels={monthLabels} revenue={monthRevenue} profit={monthProfit} />
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 12 }}>Загрузка…</div>
          )}
        </div>

        {/* Под замком карточка целиком, вместе с заголовком — как «Требуют
            действий» на главной. PRO-бейдж при этом рисуется на оверлее. */}
        <LockedCard
          locked={isFree}
          feature="expenses"
          title="Детализация расходов"
          frost
          style={{ display: 'flex', flexDirection: 'column' }}
          header={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>
                Расходы по статьям
              </span>
              <ProBadge />
            </div>
          }
        >
          {profit.expensesByCategory.length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb', padding: '20px 0', textAlign: 'center' }}>
              {derived ? 'Разбивка доступна в режиме «Период»' : 'Нет расходов за этот период'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {profit.expensesByCategory.map((e, i) => (
                <div
                  key={e.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 0',
                    borderBottom: i < profit.expensesByCategory.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : undefined,
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#444', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.label}
                  </span>
                  <div style={{ width: 110, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${(e.share / maxShare) * 100}%`, height: '100%', background: e.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', width: 36, textAlign: 'right' }}>{e.share.toFixed(1)}%</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', width: 76, textAlign: 'right' }}>
                    {Math.round(e.amount).toLocaleString('ru')} ₸
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* «Итого» внутри замка: сумма расходов — та же платная детализация,
              что и строки выше, и снаружи она бы выдавала итог бесплатно.
              Прижато к низу, чтобы совпадать с высотой графика слева. */}
          <div
            className="card-foot"
            style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '0.5px solid rgba(0,0,0,0.1)', marginTop: 'auto' }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 500, color: '#1a1a1a' }}>Итого</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: '#993C1D' }}>{profit.operatingExpenses.toLocaleString('ru')} ₸</span>
          </div>
        </LockedCard>
      </div>

      {/* ROW 3: revenue split + insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 12 }}>
            Из чего состоит выручка · {revenue.toLocaleString('ru')} ₸
          </div>
          {revenue > 0 ? (
            <>
              <div style={{ height: 22, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                {compositionRows.map((row) => (
                  <div key={row.label} style={{ flex: Math.max(row.value, 0), background: row.color }} title={`${row.label} ${((row.value / revenue) * 100).toFixed(1)}%`} />
                ))}
              </div>
              {/* Легенда идёт сразу под полосой — свободное место остаётся снизу карточки */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {compositionRows.map((row) => (
                  <SplitRow key={row.label} label={row.label} color={row.color} textColor={row.textColor} value={row.value} pct={(row.value / revenue) * 100} />
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#bbb', padding: '20px 0', textAlign: 'center' }}>Нет выручки за этот период</div>
          )}
        </div>

        <AiCard locked={isFree}>
            <div className="qs-ai-sec qs-ai-brand" style={{ marginBottom: 10 }}>QuickSell AI</div>
            <div className="qs-ai-sec">Прибыль</div>
            {ai.insights?.profitInsight?.text ? (
              <AiText text={ai.insights.profitInsight.text} />
            ) : (
              <div className="qs-ai-text">
                {aiNote ?? (
                  <>
                    Выручка <DeltaInline pct={profit.comparison.revenuePct} />, чистая прибыль{' '}
                    <DeltaInline pct={profit.comparison.netProfitPct} /> {periodLabel}.
                    {!derived && ` Заказов: ${profit.orders}, продано единиц: ${profit.unitsSold}.`}
                  </>
                )}
              </div>
            )}
            <div className="qs-ai-div" />
            <div className="qs-ai-sec">Расходы</div>
            {ai.insights?.expensesInsight?.text ? (
              <AiText text={ai.insights.expensesInsight.text} />
            ) : (
              <div className="qs-ai-text">
                {aiNote ?? (
                  <>
                    Доля расходов в выручке <span className="ai-num neu">{profit.expensesShareOfRevenuePct.toFixed(1)}%</span>
                    {topCategory && (
                      <>
                        . Крупнейшая статья — <b>{topCategory.label}</b> (
                        <span className="ai-num neu">{topCategory.share.toFixed(1)}%</span>).
                      </>
                    )}
                  </>
                )}
              </div>
            )}
        </AiCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, valueColor, children }: { label: string; value: string; valueColor: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

/** invert=true means a positive change is bad (e.g. expenses growing). */
function Delta({ pct, invert }: { pct: number | null; invert?: boolean }) {
  if (pct == null) {
    return <span style={{ fontSize: 10, color: '#ccc' }}>нет данных за пред. период</span>;
  }
  const positive = pct >= 0;
  const good = invert ? !positive : positive;
  return (
    <span style={{ fontSize: 10.5, background: good ? '#E1F5EE' : '#FAECE7', color: good ? '#085041' : '#712B13', padding: '1px 6px', borderRadius: 4 }}>
      {positive ? '▲' : '▼'} {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

function DeltaInline({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="ai-num neu">без сравнения</span>;
  const positive = pct >= 0;
  return (
    <span className={`ai-num ${positive ? 'up' : 'dn'}`}>
      {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

/** Derives and shows the previous period's absolute value from the current value + % delta. */
function PrevPeriodHint({ current, pct }: { current: number; pct: number | null }) {
  if (pct == null || pct <= -100) return null;
  const prev = current / (1 + pct / 100);
  return <span style={{ fontSize: 10, color: '#ccc' }}>пред. период: {Math.round(prev).toLocaleString('ru')} ₸</span>;
}

function SplitRow({ label, color, textColor, value, pct }: { label: string; color: string; textColor: string; value: number; pct: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: textColor }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        {label}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 500, color: textColor }}>
        {Math.round(value).toLocaleString('ru')} ₸ · {pct.toFixed(1)}%
      </span>
    </div>
  );
}
