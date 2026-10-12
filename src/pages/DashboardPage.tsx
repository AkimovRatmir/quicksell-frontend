import { useEffect, useState } from 'react';
import type { TabId } from '../types/nav';
import type { Product } from '../types/api';
import { MiniProfitChart } from '../components/charts/MiniProfitChart';
import { OrdersHeatmap } from '../components/OrdersHeatmap';
import { EmptyState } from '../components/EmptyState';
import { AiCard, LockedCard, ProBadge, useIsFree } from '../components/Pro';
import { AiItemCard, AiTags, AiText, meaningful } from '../components/AiBits';
import { aiPlaceholder, useAiInsights } from '../context/AiInsightsContext';
import { LockGlyph, useUpgrade } from '../context/UpgradeContext';
import { kaspiApi } from '../api/kaspi';
import { useSeller } from '../context/SellerContext';
import { useAnalytics } from '../lib/useAnalytics';
import { useOrdersDigest } from '../lib/useOrdersDigest';
import { selectionLabel, type PeriodSelection } from '../lib/period';

const PRODUCT_SAMPLE_LIMIT = 200;

interface ProductStat {
  sku: string;
  title: string;
  unitProfit: number;
  margin: number;
}

interface ProductStats {
  total: number;
  sampleSize: number;
  lossCount: number;
  missingCount: number;
  strongCount: number;
  topByUnitProfit: ProductStat[];
  problemItems: ProductStat[];
  /** Названия каталога — чтобы сокращать их в тексте AI-инсайта. */
  titles: string[];
}

function computeStats(total: number, data: Product[]): ProductStats {
  const withMargin: ProductStat[] = data
    .filter((p) => p.costPrice != null && p.priceMin > 0)
    .map((p) => ({
      sku: p.sku,
      title: p.title,
      unitProfit: p.priceMin - (p.costPrice as number),
      margin: ((p.priceMin - (p.costPrice as number)) / p.priceMin) * 100,
    }));
  const lossCount = withMargin.filter((m) => m.margin < 0).length;
  const strongCount = withMargin.filter((m) => m.margin >= 25).length;
  const missingCount = data.filter((p) => p.costPrice == null).length;
  const topByUnitProfit = [...withMargin].sort((a, b) => b.unitProfit - a.unitProfit).slice(0, 3);
  const problemItems = withMargin
    .filter((m) => m.margin < 15)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 3);
  const titles = data.map((p) => p.title);
  return { total, sampleSize: data.length, lossCount, missingCount, strongCount, topByUnitProfit, problemItems, titles };
}

/**
 * Маржа предыдущего периода восстанавливается из текущих значений и процентов
 * изменения — отдельного поля в API нет. Дельта считается в процентных пунктах.
 */
function marginDelta(revenue: number, netProfit: number, revenuePct: number | null, profitPct: number | null): number | null {
  if (revenuePct == null || profitPct == null || revenuePct <= -100 || profitPct <= -100) return null;
  const prevRevenue = revenue / (1 + revenuePct / 100);
  const prevProfit = netProfit / (1 + profitPct / 100);
  if (prevRevenue <= 0 || revenue <= 0) return null;
  return (netProfit / revenue) * 100 - (prevProfit / prevRevenue) * 100;
}

interface DashboardPageProps {
  onNavigate: (tab: TabId) => void;
  selection: PeriodSelection;
}

/** «сегодня, 14:32» — точная дата тут лишняя, инсайт живёт часы, а не дни. */
function formatGeneratedAt(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = at.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const isToday = at.toDateString() === new Date().toDateString();
  return isToday ? `сегодня, ${time}` : `${at.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}, ${time}`;
}

export function DashboardPage({ onNavigate, selection }: DashboardPageProps) {
  const { currentSeller } = useSeller();
  const { profit, monthly, error, derived } = useAnalytics(currentSeller?.id ?? null, selection);
  const { digest } = useOrdersDigest(currentSeller?.id ?? null);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const isFree = useIsFree();
  const { openUpgrade } = useUpgrade();
  const ai = useAiInsights();
  const aiNote = aiPlaceholder(ai);

  useEffect(() => {
    if (!currentSeller) {
      setStats(null);
      return;
    }
    kaspiApi
      .listProducts(currentSeller.id, { page: 1, limit: PRODUCT_SAMPLE_LIMIT })
      .then((res) => setStats(computeStats(res.total, res.data)))
      .catch(() => setStats(null));
  }, [currentSeller]);

  if (!currentSeller) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        Сначала подключите магазин Kaspi во вкладке «Настройки».
      </div>
    );
  }

  const periodLabel = selectionLabel(selection);
  const monthProfit = monthly?.data.map((d) => d.profit) ?? [];
  const worst = stats?.problemItems[0] ?? null;
  const best = stats && stats.topByUnitProfit.length ? [...stats.topByUnitProfit].sort((a, b) => b.margin - a.margin)[0] : null;
  const mDelta = profit ? marginDelta(profit.revenue, profit.netProfit, profit.comparison.revenuePct, profit.comparison.netProfitPct) : null;
  // Прибыль за сегодня — оценка: реальной себестоимости по свежим заказам нет,
  // поэтому берём выручку дня и применяем маржу за выбранный период.
  const todayProfit = digest && profit ? (digest.todayRevenue * profit.marginPct) / 100 : null;

  return (
    <div>
      {error && (
        <div style={{ background: '#FAECE7', color: '#993C1D', border: '0.5px solid #F0997B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* РЯД 1: Финансы + Заказы. minmax(0,1fr) — иначе колонка растёт под
          самую длинную неразрывную строку внутри и ряд перестаёт быть 50/50 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <CardHead title={`Финансы · ${periodLabel}`} action="Узнать почему →" onAction={() => onNavigate('finance')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Tile label="Выручка" value={profit ? `${profit.revenue.toLocaleString('ru')} ₸` : '—'} color="#1a1a1a">
              {profit && <DeltaBadge pct={profit.comparison.revenuePct} />}
            </Tile>
            <Tile label="Чистая прибыль" value={profit ? `${profit.netProfit.toLocaleString('ru')} ₸` : '—'} color="#0F6E56">
              {profit && <DeltaBadge pct={profit.comparison.netProfitPct} />}
            </Tile>
            <Tile label="Средняя маржа" value={profit ? `${profit.marginPct.toFixed(1)}%` : '—'} color="#534AB7">
              {mDelta != null && <DeltaBadge pct={mDelta} suffix="п.п." />}
            </Tile>
          </div>
          {monthly && monthProfit.length > 0 ? (
            <div style={{ height: 88, marginTop: 4 }}>
              <MiniProfitChart profit={monthProfit} height={88} />
            </div>
          ) : (
            <div style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>—</div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Заказы" action="Подробнее →" onAction={() => (isFree ? openUpgrade('orders') : onNavigate('finance'))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Tile label="На сумму сегодня" value={digest ? tenge(digest.todayRevenue) : '—'} color="#534AB7">
              {digest &&
                (digest.todayOrders > 0 ? (
                  <Pill tone="purple">
                    {digest.todayOrders} {plural(digest.todayOrders, 'заказ', 'заказа', 'заказов')}
                    {/* Активные заказы ещё могут отмениться — сумма не финальная */}
                    {digest.todayActiveOrders > 0 && ` · ${digest.todayActiveOrders} в работе`}
                  </Pill>
                ) : (
                  // Ноль за сегодня — это либо выходной, либо несвежая выгрузка.
                  // Дата последнего заказа сразу показывает, какой из двух случаев.
                  <Pill tone="neutral">
                    {digest.lastOrderAt ? `последний заказ: ${formatDay(digest.lastOrderAt)}` : 'заказов нет'}
                  </Pill>
                ))}
            </Tile>
            <Tile label="Прибыль сегодня" value={todayProfit != null ? tenge(todayProfit) : '—'} color="#534AB7">
              {profit && digest && digest.todayOrders > 0 && (
                <Pill tone={profit.marginPct >= 0 ? 'teal' : 'coral'}>≈ по марже {profit.marginPct.toFixed(0)}%</Pill>
              )}
              {profit && digest && digest.todayOrders === 0 && <Pill tone="neutral">нет продаж сегодня</Pill>}
            </Tile>
            <Tile label="Средний чек" value={digest ? tenge(digest.avgCheck) : '—'} color="#534AB7">
              {digest && <Pill tone="purple">{digest.avgCheckIsWindow ? `за ${digest.weeks} нед.` : 'за сегодня'}</Pill>}
            </Tile>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            <OrdersHeatmap week={digest?.week ?? null} />
          </div>
        </div>
      </div>

      {/* QuickSell AI — во всю ширину под верхними виджетами */}
      <AiCard locked={isFree} style={{ marginBottom: 10 }}>
        <div className="qs-ai-sec qs-ai-brand" style={{ fontSize: 11, letterSpacing: '0.06em' }}>
          QuickSell AI
        </div>
        {/* Пока инсайта нет — своя сводка по цифрам, а не пустое место */}
        {ai.insights?.headline?.text ? (
          <AiText
            text={ai.insights.headline.text}
            verdict={ai.insights.headline.verdict}
            style={{ fontSize: 13.5 }}
            shortenNames={stats?.titles}
            clampLines={2}
          />
        ) : (
          <div className="qs-ai-text" style={{ fontSize: 13.5 }}>
            {aiNote ??
              (profit ? (
                <>
                  Выручка <DeltaInline pct={profit.comparison.revenuePct} /> при марже{' '}
                  <span className="ai-num neu">{profit.marginPct.toFixed(1)}%</span>, чистая прибыль{' '}
                  <DeltaInline pct={profit.comparison.netProfitPct} /> {periodLabel}.
                  {stats && stats.lossCount > 0
                    ? ` ${stats.lossCount} ${plural(stats.lossCount, 'товар', 'товара', 'товаров')} работают в убыток.`
                    : ' Убыточных товаров нет.'}
                </>
              ) : (
                'Загружаем сводку…'
              ))}
          </div>
        )}
        {ai.insights?.headline?.tags ? (
          <AiTags tags={ai.insights.headline.tags} />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {worst && (
              <span style={{ fontSize: 11.5, background: 'rgba(250,236,231,0.9)', color: '#712B13', padding: '3px 10px', borderRadius: 6 }}>
                ⚠ {trim(worst.title, 26)} — {worst.margin < 0 ? 'убыток' : 'низкая маржа'}
              </span>
            )}
            {stats && stats.missingCount > 0 && (
              <span style={{ fontSize: 11.5, background: 'rgba(250,238,218,0.9)', color: '#854F0B', padding: '3px 10px', borderRadius: 6 }}>
                ~ {stats.missingCount} SKU без себестоимости
              </span>
            )}
            {best && (
              <span style={{ fontSize: 11.5, background: 'rgba(225,245,238,0.9)', color: '#085041', padding: '3px 10px', borderRadius: 6 }}>
                ↑ {trim(best.title, 26)} — маржа {best.margin.toFixed(0)}%
              </span>
            )}
            {derived && (
              <span style={{ fontSize: 11.5, background: 'rgba(238,237,254,0.9)', color: '#534AB7', padding: '3px 10px', borderRadius: 6 }}>
                отчёт {periodLabel}
              </span>
            )}
          </div>
        )}
        {/* Подвал-полоска — как в прототипе. На free это upsell пошагового плана,
            на PRO план уже доступен, поэтому там та же полоска показывает,
            на чём построен разбор, и даёт его перегенерировать. */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(127,119,221,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Замок — только на free; на Pro он читался бы как «закрыто» */}
          {isFree && (
            <span style={{ display: 'flex', flexShrink: 0 }}>
              <LockGlyph size={15} strokeWidth={1.8} color="#7F77DD" />
            </span>
          )}
          {isFree ? (
            <>
              <span style={{ fontSize: 12, color: '#7166c9', flex: 1 }}>
                Разблокируйте пошаговый план: что сделать с каждой проблемой и точкой роста <ProBadge small />
              </span>
              <span
                onClick={() => openUpgrade('reco')}
                style={{ fontSize: 12, color: '#534AB7', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Открыть →
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#7166c9', flex: 1 }}>
                Данные {periodLabel}
                {ai.generatedAt && ` · обновлено ${formatGeneratedAt(ai.generatedAt)}`}
              </span>
              <span
                onClick={ai.isLoading ? undefined : ai.refresh}
                style={{ fontSize: 12, color: '#534AB7', fontWeight: 500, cursor: ai.isLoading ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: ai.isLoading ? 0.5 : 1 }}
              >
                {ai.isLoading ? 'Считаем…' : 'Обновить →'}
              </span>
            </>
          )}
        </div>
      </AiCard>

      {/* НИЖНИЙ РЯД: три равные колонки, как в прототипе. Названия товаров в
          карточках не переносятся, и с обычным 1fr «Требуют действий» тянула
          ширину под самое длинное из них, зажимая соседей */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <LockedCard
          locked={isFree}
          feature="reco"
          title="Требуют действий"
          header={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>
                Требуют действий
              </span>
              <ProBadge />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ai.insights?.requiresAction?.length ? (
              // AI видит те же товары, но объясняет причину словами — приоритет ему
              ai.insights.requiresAction.map((item, i) => (
                <AiItemCard
                  key={`${item.title}-${i}`}
                  title={item.title}
                  detail={item.detail}
                  badge={item.badge}
                  tone={item.tone}
                  footer="Открыть товары →"
                  onClick={() => onNavigate('products')}
                />
              ))
            ) : ai.isLoading ? (
              <div style={{ fontSize: 12, color: '#bbb' }}>QuickSell AI разбирает цифры…</div>
            ) : !stats ? (
              <div style={{ fontSize: 12, color: '#bbb' }}>Загрузка…</div>
            ) : stats.problemItems.length === 0 ? (
              <EmptyState text="Проблемных товаров пока нет" />
            ) : (
              stats.problemItems.map((item) => {
                const isLoss = item.margin < 0;
                return (
                  <div key={item.sku} className="act-card" onClick={() => onNavigate('products')} style={{ padding: '11px 13px', borderRadius: 9, background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 10.5, background: isLoss ? '#FAECE7' : '#FAEEDA', color: isLoss ? '#712B13' : '#854F0B', padding: '1px 7px', borderRadius: 4, flexShrink: 0 }}>
                        {isLoss ? `убыток ${item.margin.toFixed(0)}%` : 'низкая маржа'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#888' }}>
                      {item.unitProfit >= 0 ? '+' : ''}
                      {Math.round(item.unitProfit).toLocaleString('ru')} ₸/ед · маржа {item.margin.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#7F77DD', marginTop: 5 }}>Открыть товар →</div>
                  </div>
                );
              })
            )}
          </div>
        </LockedCard>

        <LockedCard
          locked={isFree}
          feature="growth"
          title="Точки роста"
          frost
          header={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>Точки роста</span>
              <ProBadge />
            </div>
          }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ai.insights?.growthPoints?.length ? (
                ai.insights.growthPoints.map((point, i) => {
                  // «Не указано» вместо суммы — не значение, такую строку прячем
                  const potential = meaningful(point.potential);
                  return (
                    <AiItemCard
                      key={`${point.title}-${i}`}
                      tinted
                      title={point.title}
                      detail={point.detail}
                      tone={point.tone}
                      footer={potential ? `Потенциал ${potential} →` : 'Открыть товары →'}
                      onClick={() => onNavigate('products')}
                    />
                  );
                })
              ) : ai.isLoading ? (
                <div style={{ fontSize: 12, color: '#bbb' }}>QuickSell AI разбирает цифры…</div>
              ) : (
                <>
              {best && (
                <GrowthCard
                  tone="good"
                  title={`Масштабировать: ${trim(best.title, 24)}`}
                  detail={`Лучшая маржа ${best.margin.toFixed(0)}% · +${Math.round(best.unitProfit).toLocaleString('ru')} ₸/ед`}
                  cta="Вложиться в закупку →"
                  onClick={() => onNavigate('products')}
                />
              )}
              {stats && stats.missingCount > 0 && (
                <GrowthCard
                  tone="purple"
                  title="Заполнить себестоимость"
                  detail={`${stats.missingCount} SKU без данных — прибыль считается неточно`}
                  cta="Открыть настройки →"
                  onClick={() => onNavigate('settings')}
                />
              )}
              {worst && (
                <GrowthCard
                  tone="good"
                  title={`Убрать из убытка: ${trim(worst.title, 24)}`}
                  detail={`Маржа ${worst.margin.toFixed(1)}% — поднять цену или пересмотреть закупку`}
                  cta="Открыть товар →"
                  onClick={() => onNavigate('products')}
                />
              )}
              {!best && !worst && (!stats || stats.missingCount === 0) && (
                <div style={{ fontSize: 12, color: '#888' }}>Пока нет рекомендаций — данные в порядке.</div>
              )}
                </>
              )}
            </div>
        </LockedCard>

        {/* Открыто на любом тарифе, как в прототипе: это навигация, а не аналитика */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 10 }}>
            Быстрые действия
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickAction icon="📊" title="Рассчитать юнит-экономику" sub="Проверить новый товар" onClick={() => onNavigate('unitec')} />
            <QuickAction
              icon="🔍"
              title="Открыть проблемные товары"
              sub={stats ? `${stats.lossCount} убыточных · ${stats.problemItems.length} требуют внимания` : '—'}
              onClick={() => onNavigate('products')}
            />
            <QuickAction
              icon="⚙️"
              title="Обновить себестоимость"
              sub={stats ? (stats.missingCount > 0 ? `${stats.missingCount} SKU без данных` : 'всё заполнено') : '—'}
              onClick={() => onNavigate('settings')}
            />
            <QuickAction
              icon="⟳"
              title="Синхронизировать данные"
              sub={currentSeller.lastSyncAt ? `Последний раз: ${new Date(currentSeller.lastSyncAt).toLocaleString('ru')}` : 'ещё не синхронизировано'}
              onClick={() => onNavigate('settings')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CardHead({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>{title}</span>
      <button onClick={onAction} style={{ fontSize: 11, color: '#7F77DD', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
        {action}
      </button>
    </div>
  );
}

function Tile({ label, value, color, children }: { label: string; value: string; color: string; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color, letterSpacing: '-0.01em' }}>{value}</div>
      {children}
    </div>
  );
}

const pillTones = {
  purple: { bg: '#EEEDFE', color: '#3C3489' },
  teal: { bg: '#E1F5EE', color: '#085041' },
  coral: { bg: '#FAECE7', color: '#712B13' },
  neutral: { bg: '#F1EFE8', color: '#5F5E5A' },
};

function Pill({ tone, children }: { tone: keyof typeof pillTones; children: React.ReactNode }) {
  const styles = pillTones[tone];
  return (
    <div style={{ fontSize: 10.5, background: styles.bg, color: styles.color, padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 3 }}>
      {children}
    </div>
  );
}

/** Округляет и убирает артефакт «−0» при нулевой выручке и отрицательной марже. */
function tenge(value: number): string {
  const rounded = Math.round(value) + 0;
  return `${(rounded === 0 ? 0 : rounded).toLocaleString('ru')} ₸`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
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

function DeltaBadge({ pct, suffix }: { pct: number | null; suffix?: string }) {
  if (pct == null) return <div style={{ fontSize: 10, color: '#ccc', marginTop: 3 }}>нет сравнения</div>;
  const positive = pct >= 0;
  return (
    <div
      style={{
        fontSize: 10.5,
        background: positive ? '#E1F5EE' : '#FAECE7',
        color: positive ? '#085041' : '#712B13',
        padding: '1px 6px',
        borderRadius: 4,
        display: 'inline-block',
        marginTop: 3,
      }}
    >
      {positive ? '▲ +' : '▼ '}
      {pct.toFixed(1)}
      {suffix ? ` ${suffix}` : '%'}
    </div>
  );
}

const growthToneStyles: Record<'good' | 'purple', { bg: string; border: string; title: string; body: string; cta: string }> = {
  good: { bg: '#F0FDF8', border: '#9FE1CB', title: '#085041', body: '#1D9E75', cta: '#0F6E56' },
  purple: { bg: '#EEEDFE', border: '#AFA9EC', title: '#3C3489', body: '#534AB7', cta: '#534AB7' },
};

function GrowthCard({ tone, title, detail, cta, onClick }: { tone: 'good' | 'purple'; title: string; detail: string; cta: string; onClick: () => void }) {
  const t = growthToneStyles[tone];
  return (
    <div className="act-card" onClick={onClick} style={{ padding: '11px 13px', borderRadius: 9, background: t.bg, borderColor: t.border }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: t.title, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: t.body }}>{detail}</div>
      <div style={{ fontSize: 11, color: t.cta, marginTop: 5, fontWeight: 500 }}>{cta}</div>
    </div>
  );
}

function QuickAction({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      className="act-card"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '11px 13px',
        borderRadius: 9,
        background: '#fafafa',
        fontFamily: 'inherit',
        fontSize: 12.5,
        color: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <span style={{ color: '#7F77DD', fontSize: 13 }}>→</span>
    </button>
  );
}
