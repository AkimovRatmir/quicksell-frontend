import { useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import { useSeller } from '../context/SellerContext';
import { Pagination } from '../components/Pagination';
import { SearchField } from '../components/SearchField';
import { EmptyState } from '../components/EmptyState';
import { AiCard, useIsFree } from '../components/Pro';
import { AiText } from '../components/AiBits';
import { aiPlaceholder, useAiInsights } from '../context/AiInsightsContext';
import { LockGlyph, useUpgrade } from '../context/UpgradeContext';
import { ProductsTable, PRODUCT_COLUMN_COUNT } from '../components/ProductsTable';
import { ExpandButton, ProductsFullscreen } from '../components/ProductsFullscreen';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { loadCatalog } from '../lib/catalog';
import { type PeriodSelection } from '../lib/period';
import type { AnalyticsPeriod, ProductSales, ProductStatsFilter, ProductStatsResponse } from '../types/api';
import { classifyAbc, loadProductMix, turnoverTop, type ProductMix } from '../lib/productMix';

const PAGE_LIMIT = 20;
/** Сколько строк таблицы товаров открыто на бесплатном тарифе. */
const FREE_ROW_LIMIT = 3;
/** Сколько закрытых строк показываем под ними перед upsell-плашкой. */
const FREE_LOCKED_ROWS = 8;

/** Сколько лидеров показываем в концентрации прибыли, остальное — одной строкой. */
const CONCENTRATION_TOP = 5;
/** Оттенки от самого крупного вклада к самому мелкому; последний — «остальные». */
const MIX_SHADES = ['#7F77DD', '#AFA9EC', '#C5C1EC', '#D9D7F5', '#E8E6FA'];
const MIX_REST = '#f0f0f0';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  '7d': 'за 7 дней',
  '30d': 'за 30 дней',
  '90d': 'за 90 дней',
  '12m': 'за 12 месяцев',
};

/**
 * Статистика по товарам умеет только скользящие периоды — календарного
 * диапазона у неё нет. В режиме «Отчёт» показываем 30 дней и честно
 * подписываем это в подвале, а не выдаём чужой период за выбранный.
 */
function statsPeriod(selection: PeriodSelection): AnalyticsPeriod {
  return selection.mode === 'period' ? selection.period : '30d';
}

interface ProblemItem {
  sku: string;
  title: string;
  profit: number;
  margin: number;
}

interface CatalogStats {
  total: number;
  sampleSize: number;
  avgMargin: number | null;
  lossCount: number;
  missingCostCount: number;
  /** Сколько SKU из выборки дают 80% суммарной прибыли с единицы. */
  concentrationCount: number | null;
  /** SKU без остатка на складе — деньги заморожены, продаж нет. */
  deadCount: number;
  problemItems: ProblemItem[];
  /** Товар с лучшей маржой — кандидат на масштабирование. */
  bestItem: ProblemItem | null;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Сколько позиций набирают 80% суммарной прибыли (правило Парето). */
function concentration(profits: number[]): number | null {
  const positive = profits.filter((p) => p > 0).sort((a, b) => b - a);
  const sum = positive.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  let acc = 0;
  for (let i = 0; i < positive.length; i++) {
    acc += positive[i];
    if (acc >= sum * 0.8) return i + 1;
  }
  return positive.length;
}

export function ProductsPage({ selection }: { selection: PeriodSelection }) {
  const { currentSeller } = useSeller();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductStatsFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  // Продажи по SKU за период — источник таблицы. Фильтр, поиск и страницы
  // считает бэкенд, поэтому здесь лежит ровно текущая страница.
  const [sales, setSales] = useState<ProductStatsResponse | null>(null);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Товар, открытый в отдельном виджете показателей.
  const [detail, setDetail] = useState<ProductSales | null>(null);
  // Продажи по всему ассортименту за период: питают концентрацию прибыли,
  // ABC-группы и оборачиваемость. Из основной выдачи их не собрать — там
  // активны фильтр, поиск и текущая страница.
  const [mix, setMix] = useState<ProductMix | null>(null);
  const isFree = useIsFree();
  const { openUpgrade } = useUpgrade();
  const ai = useAiInsights();
  const aiNote = aiPlaceholder(ai);

  const period = statsPeriod(selection);
  const periodLabel = PERIOD_LABELS[period];

  // Смена фильтра, поиска или периода меняет состав списка — страницу начинаем
  // заново до запроса, иначе на 5-й странице нового набора окажется пусто.
  useEffect(() => {
    setPage(1);
  }, [filter, search, period]);

  // Серверная выдача нужна только фильтру «Все». «Топ» и «Слабые» считаются
  // по полному списку на клиенте: бэкенд сортирует по прибыли честно, но у
  // товаров без себестоимости прибыль равна выручке, и они всплывают наверх
  // «Топа» с маржой 80% — это не топ, это дыра в данных.
  useEffect(() => {
    if (!currentSeller || filter !== 'all') return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setIsSalesLoading(true);
      analyticsApi
        .getProductStats(currentSeller.id, {
          period,
          filter: 'all',
          search: search.trim() || undefined,
          page,
          limit: PAGE_LIMIT,
        })
        .then((res) => {
          if (!cancelled) {
            setSales(res);
            setError(null);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setSales(null);
          setError(extractErrorMessage(err, 'Не удалось загрузить статистику продаж'));
        })
        .finally(() => {
          if (!cancelled) setIsSalesLoading(false);
        });
      // Поиск печатают посимвольно — без задержки это запрос на каждую букву.
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [currentSeller, period, filter, search, page]);

  useEffect(() => {
    if (!currentSeller) {
      setMix(null);
      return;
    }
    let cancelled = false;
    loadProductMix(currentSeller.id, period)
      .then((res) => {
        if (!cancelled) setMix(res);
      })
      .catch(() => {
        if (!cancelled) setMix(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSeller, period]);

  // Каталог целиком: KPI и «Требуют действий» должны быть верны независимо от
  // того, какая страница или поиск открыты сейчас.
  useEffect(() => {
    if (!currentSeller) {
      setStats(null);
      return;
    }
    loadCatalog(currentSeller.id)
      .then((snapshot) => {
        const margins: ProblemItem[] = snapshot.items
          .filter((p) => p.costPrice != null && p.priceMin > 0)
          .map((p) => ({
            sku: p.sku,
            title: p.title,
            profit: p.priceMin - (p.costPrice as number),
            margin: ((p.priceMin - (p.costPrice as number)) / p.priceMin) * 100,
          }));
        const avgMargin = margins.length ? margins.reduce((a, b) => a + b.margin, 0) / margins.length : null;
        const lossCount = margins.filter((m) => m.margin < 0).length;
        const missingCostCount = snapshot.items.filter((p) => p.costPrice == null).length;
        const deadCount = snapshot.items.filter((p) => !p.available || p.totalStock === 0).length;
        const concentrationCount = concentration(margins.map((m) => m.profit));
        const problemItems = margins
          .filter((m) => m.margin < 15)
          .sort((a, b) => a.margin - b.margin)
          .slice(0, 3);
        const bestItem = margins.length ? margins.reduce((a, b) => (b.margin > a.margin ? b : a)) : null;
        setStats({
          total: snapshot.total,
          sampleSize: snapshot.items.length,
          avgMargin,
          lossCount,
          missingCostCount,
          concentrationCount,
          deadCount,
          problemItems,
          bestItem,
        });
      })
      .catch(() => setStats(null));
  }, [currentSeller]);

  if (!currentSeller) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        Сначала подключите магазин Kaspi во вкладке «Настройки».
      </div>
    );
  }

  const sampleNote = stats && stats.total > stats.sampleSize ? ` (по ${stats.sampleSize} из ${stats.total})` : '';
  const worstItem = stats?.problemItems[0] ?? null;
  const bestItem = stats?.bestItem ?? null;

  // «Топ»: прибыльные с заполненной себестоимостью, по убыванию прибыли.
  // «Слабые»: убыточные и с маржой ниже 10% — здесь товары без себестоимости
  // тоже не участвуют, их прибыль неизвестна, а не мала.
  const needle = search.trim().toLowerCase();
  const localRows =
    filter === 'all'
      ? null
      : (mix?.rows ?? [])
          .filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle))
          .filter((r) => !r.costMissing)
          .filter((r) => (filter === 'top' ? r.profit > 0 : r.profit <= 0 || (r.marginPct ?? 0) < 10))
          .sort((a, b) => (filter === 'top' ? b.profit - a.profit : a.profit - b.profit));
  const matchedTotal = localRows ? localRows.length : (sales?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(matchedTotal / PAGE_LIMIT));
  const pageRows = localRows ? localRows.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT) : (sales?.data ?? []);
  const isTableLoading = filter === 'all' ? isSalesLoading : mix == null;
  // На бесплатном тарифе показываем первые строки целиком, остальные — под замком.
  const shownRows = isFree ? pageRows.slice(0, FREE_ROW_LIMIT) : pageRows;
  // Закрытых строк показываем немного: они нужны как «дразнилка», а upsell-плашка
  // под ними должна попадать в экран без прокрутки таблицы.
  const lockedRows = isFree ? pageRows.slice(FREE_ROW_LIMIT, FREE_ROW_LIMIT + FREE_LOCKED_ROWS) : [];
  const countLabel = `${matchedTotal} ${plural(matchedTotal, 'товар', 'товара', 'товаров')}`;
  const emptyText = isTableLoading
    ? 'Загружаем статистику продаж…'
    : search.trim()
      ? 'Ничего не найдено'
      : filter === 'top'
        ? `Прибыльных товаров ${periodLabel} нет`
        : filter === 'weak'
          ? `Слабых товаров ${periodLabel} нет`
          : `Продаж ${periodLabel} не было`;

  const upsellRow =
    lockedRows.length > 0 ? (
      <tr>
        <td colSpan={PRODUCT_COLUMN_COUNT} style={{ padding: 0, border: 'none' }}>
          <div className="upsell-inner" onClick={() => openUpgrade('products')}>
            <LockGlyph size={20} />
            <div className="u-txt">
              <div className="u-t1">
                Ещё {Math.max(matchedTotal - FREE_ROW_LIMIT, lockedRows.length)} товаров скрыто{' '}
                <span className="pro-badge-sm">PRO</span>
              </div>
              <div className="u-t2">
                {stats && stats.lossCount > 0
                  ? `Среди них ${stats.lossCount} убыточных SKU — откройте, чтобы увидеть какие товары теряют деньги`
                  : 'Откройте полный список, прибыль и маржу по каждому товару'}
              </div>
            </div>
            <button className="upsell-btn">Показать все</button>
          </div>
        </td>
      </tr>
    ) : null;

  // Сегменты диаграммы: лидеры по прибыли + сводная строка «остальные».
  // Доли берём из ответа, а не считаем сами: бэкенд знает общую прибыль за
  // период, включая позиции, которые в наши страницы могли не влезть.
  const profitableRows = (mix?.rows ?? []).filter((r) => r.profit > 0);
  const mixLeaders = profitableRows.slice(0, CONCENTRATION_TOP).map((r, i) => ({
    key: r.sku,
    name: r.title,
    pct: Math.max(0, r.profitSharePct ?? 0),
    color: MIX_SHADES[i] ?? MIX_SHADES[MIX_SHADES.length - 1],
  }));
  const leadersPct = mixLeaders.reduce((sum, s) => sum + s.pct, 0);
  const restCount = Math.max(0, profitableRows.length - mixLeaders.length);
  // Округления в долях не дают ровных 100% — остаток не может быть отрицательным.
  const restPct = Math.max(0, 100 - leadersPct);
  const mixSegments =
    restCount > 0 && restPct > 0
      ? [...mixLeaders, { key: '__rest__', name: `Остальные ${restCount} SKU`, pct: restPct, color: MIX_REST }]
      : mixLeaders;

  const abc = classifyAbc(mix?.rows ?? []);
  const turnover = turnoverTop(mix?.rows ?? []);

  // Товары, у которых вместо названия артикул: карточки в каталоге нет, и
  // пользователь не понимает, что это такое. Объясняем один раз под таблицей.
  const orphanCount = pageRows.filter((r) => r.title === r.sku).length;
  const orphanNote =
    orphanCount > 0 ? (
      <div className="tbl-note">
        <span className="tbl-note-mark">⚠</span>
        <span>
          <b>{orphanCount} {plural(orphanCount, 'товар', 'товара', 'товаров')} показаны артикулом</b> — их карточки нет в каталоге: товар снят с продажи
          в Kaspi или ещё не подтянулся. Продажи по ним учтены, но себестоимости нет, поэтому прибыль завышена, а в «Топ» они не попадают.
          Обновить каталог можно в Настройках → «Синхронизировать».
        </span>
      </div>
    ) : null;

  const pager = (
    <>
      <span>
        {isFree
          ? `Показано ${shownRows.length} из ${matchedTotal} · полный список в PRO`
          : `${countLabel} с продажами ${periodLabel} · страница ${page} из ${totalPages}`}
        {/* «Отчёт» этот эндпоинт не поддерживает — не выдаём 30 дней за выбранный месяц */}
        {selection.mode === 'report' && ' · режим «Отчёт» здесь пока недоступен'}
      </span>
      {!isFree && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </>
  );

  return (
    <div>
      {detail && <ProductDetailModal row={detail} periodLabel={periodLabel} onClose={() => setDetail(null)} />}
      {isFullscreen && (
        <ProductsFullscreen
          title="Товары"
          count={countLabel}
          onClose={() => setIsFullscreen(false)}
          footer={pager}
        >
          <ProductsTable rows={shownRows} lockedRows={lockedRows} emptyText={emptyText} onRowClick={setDetail} big>
            {upsellRow}
          </ProductsTable>
          {orphanNote}
        </ProductsFullscreen>
      )}

      {/* KPI row — sampled across the whole catalog, not just the current page */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 10 }}>
        <MiniKpi label="Активные SKU" value={stats ? String(stats.total) : '—'} pill={{ text: 'по данным Kaspi', tone: 'teal' }} />
        <MiniKpi
          label="Средняя маржа"
          value={stats?.avgMargin != null ? `${stats.avgMargin.toFixed(1)}%` : '—'}
          valueColor="#534AB7"
          pill={stats ? { text: `с себестоимостью${sampleNote}`, tone: 'neutral' } : undefined}
        />
        <MiniKpi
          label="Убыточные SKU"
          value={stats ? String(stats.lossCount) : '—'}
          valueColor={stats && stats.lossCount > 0 ? '#993C1D' : '#1a1a1a'}
          pill={stats && stats.lossCount > 0 ? { text: 'теряют деньги', tone: 'coral' } : undefined}
        />
        <MiniKpi
          label="Концентрация"
          value={stats?.concentrationCount != null ? `${stats.concentrationCount} SKU` : '—'}
          note={stats?.concentrationCount != null ? 'дают 80% прибыли' : 'нужна себестоимость'}
        />
        <MiniKpi
          label="Мёртвые SKU"
          value={stats ? String(stats.deadCount) : '—'}
          valueColor={stats && stats.deadCount > 0 ? '#993C1D' : '#1a1a1a'}
          note="нет в наличии · нулевой остаток"
        />
      </div>

      {error && (
        <div style={{ background: '#FAECE7', color: '#993C1D', border: '0.5px solid #F0997B', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* AI-инсайт сразу под KPI — как в прототипе */}
      <AiCard locked={isFree} style={{ marginBottom: 10 }}>
        <div className="qs-ai-sec qs-ai-brand">QuickSell AI</div>
        {/* Сплошной абзац, как в прототипе: модель отдаёт 1-2 предложения
            свободной формы — что в плюсе, что в минусе и что с этим делать */}
        {ai.insights?.productsInsight?.text ? (
          <AiText text={ai.insights.productsInsight.text} />
        ) : aiNote ? (
          <div className="qs-ai-text">{aiNote}</div>
        ) : (
        <div className="qs-ai-text">
          {stats ? (
            <>
              {stats.concentrationCount != null && (
                <>
                  Ассортимент сконцентрирован: <span className="ai-num neu">{stats.concentrationCount} SKU</span> дают{' '}
                  <span className="ai-num neu">80% прибыли</span>.{' '}
                </>
              )}
              {stats.lossCount > 0 && worstItem ? (
                <>
                  «{worstItem.title}» работает <b style={{ color: '#993C1D' }}>в минус</b> (маржа{' '}
                  <span className="ai-num dn">{worstItem.margin.toFixed(1)}%</span>) — стоит поднять цену или убрать из
                  ассортимента.{' '}
                </>
              ) : (
                <>Убыточных товаров нет. </>
              )}
              {bestItem && (
                <>
                  Точка роста — «{bestItem.title}»: <b style={{ color: '#0F6E56' }}>лучшая маржа</b>{' '}
                  <span className="ai-num up">{bestItem.margin.toFixed(0)}%</span>, есть смысл увеличить закупку.
                </>
              )}
              {stats.missingCostCount > 0 && (
                <> У <span className="ai-num dn">{stats.missingCostCount} SKU</span> не заполнена себестоимость — цифры неполные.</>
              )}
            </>
          ) : (
            'Загружаем разбор ассортимента…'
          )}
        </div>
        )}
      </AiCard>

      {/* Products table + needs-attention signals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 10, marginBottom: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>
              Товары
              <span style={{ fontSize: 11.5, color: '#aaa', fontWeight: 400, marginLeft: 6 }}>{countLabel}</span>
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchField value={search} onChange={setSearch} />
              <FilterPill label="Все" active={filter === 'all'} onClick={() => setFilter('all')} tone="neutral" />
              <FilterPill label="Топ" active={filter === 'top'} onClick={() => setFilter('top')} tone="good" />
              <FilterPill label="Слабые" active={filter === 'weak'} onClick={() => setFilter('weak')} tone="bad" />
              <ExpandButton onClick={() => setIsFullscreen(true)} />
            </div>
          </div>

          {/* На free список короткий и заканчивается upsell-плашкой — скролл внутри
              таблицы её бы прятал, поэтому ограничиваем высоту только в PRO */}
          <div style={isFree ? undefined : { maxHeight: 460, overflowY: 'auto' }}>
            <ProductsTable rows={shownRows} lockedRows={lockedRows} emptyText={emptyText} onRowClick={setDetail}>
              {upsellRow}
            </ProductsTable>
          </div>

          {orphanNote}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: '#888' }}>
            {pager}
          </div>
        </div>

        {/* Требуют действий — derived from the same catalog stats sample */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Требуют действий
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!stats ? (
              <div style={{ fontSize: 12, color: '#bbb' }}>Загрузка…</div>
            ) : stats.problemItems.length === 0 ? (
              <EmptyState text="Проблемных товаров пока нет" />
            ) : (
              stats.problemItems.map((item) => {
                const isLoss = item.margin < 0;
                return (
                  <div key={item.sku} style={{ padding: '8px 10px', borderRadius: 7, background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          background: isLoss ? '#FAECE7' : '#FAEEDA',
                          color: isLoss ? '#712B13' : '#854F0B',
                          padding: '1px 7px',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        {isLoss ? 'убыток' : 'низкая маржа'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#888' }}>
                      {item.profit >= 0 ? '+' : ''}
                      {Math.round(item.profit).toLocaleString('ru')} ₸/ед · маржа {item.margin.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
                      → {isLoss ? 'Поднять цену или пересмотреть закупку' : 'Пересмотреть цену закупки'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Аналитика продаж
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: '#1a1a1a' }}>Концентрация прибыли по SKU</span>
            <span style={{ fontSize: 10.5, color: '#aaa' }}>{periodLabel}</span>
          </div>
          {mixSegments.length === 0 ? (
            <EmptyState text={mix ? `Прибыльных товаров ${periodLabel} нет` : 'Загружаем разбор прибыли…'} />
          ) : (
            <>
              <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 14 }}>
                {mixSegments.map((c) => (
                  <div key={c.key} style={{ flex: c.pct, background: c.color }} title={`${c.name} — ${c.pct.toFixed(1)}%`} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {mixSegments.map((c, i) => (
                  <div
                    key={c.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11.5,
                      gap: 10,
                      // Строки длинные — их разделяет не отступ, а линия,
                      // иначе взгляд не цепляется за границу между товарами
                      padding: '7px 0',
                      borderBottom: i < mixSegments.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : undefined,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#555', minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
                        {c.name}
                      </span>
                    </span>
                    <span style={{ fontWeight: 500, color: '#1a1a1a', flexShrink: 0 }}>{Math.round(c.pct)}%</span>
                  </div>
                ))}
              </div>
              {/* Правило Парето читается только вместе с числом товаров */}
              <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 12 }}>
                {mixLeaders.length} из {profitableRows.length} прибыльных SKU дают {Math.round(leadersPct)}% прибыли
              </div>
            </>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: '#1a1a1a' }}>ABC-анализ · Оборачиваемость</span>
            <span style={{ fontSize: 10.5, color: '#aaa' }}>{periodLabel}</span>
          </div>
          {!abc ? (
            <EmptyState text={mix ? `Продаж ${periodLabel} не было` : 'Считаем ABC-группы…'} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <AbcGroup label="Группа A" count={abc.a.count} pct={abc.a.sharePct} bg="#EEEDFE" color="#534AB7" sub="#7F77DD" />
                <AbcGroup label="Группа B" count={abc.b.count} pct={abc.b.sharePct} bg="#f5f5f7" color="#555" sub="#888" />
                <AbcGroup label="Группа C" count={abc.c.count} pct={abc.c.sharePct} bg="#FAECE7" color="#993C1D" sub="#D85A30" />
              </div>
              {/* Убыточные попадают в C, но по доле прибыли их не видно — пишем числом */}
              <div style={{ fontSize: 10.5, color: '#aaa' }}>
                {abc.lossCount > 0
                  ? `В группе C ${abc.lossCount} ${plural(abc.lossCount, 'убыточный SKU', 'убыточных SKU', 'убыточных SKU')}`
                  : 'Убыточных SKU нет'}
              </div>
            </>
          )}
          {/* Второй смысловой блок карточки — отделяем линией, а не отступом */}
          <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.07)', margin: '16px 0 14px' }} />
          <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 500 }}>
            Топ по оборачиваемости
          </div>
          {turnover.length === 0 ? (
            <div style={{ fontSize: 11.5, color: '#bbb', padding: '7px 0' }}>{mix ? 'Продаж нет' : 'Загрузка…'}</div>
          ) : (
            turnover.map((t, i) => (
              <div
                key={t.sku}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: i < turnover.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : undefined,
                  fontSize: 11.5,
                }}
              >
                <span style={{ color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>
                  {t.title}
                </span>
                {/* «шт/мес» было бы враньём: период выбирается сверху и может быть 7 дней */}
                <span style={{ fontWeight: 500, color: '#1a1a1a', flexShrink: 0 }}>{t.units} шт</span>
              </div>
            ))
          )}
          {mix?.truncated && (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 12 }}>
              Посчитано по первым {mix.rows.length} из {mix.total} товаров
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone: 'neutral' | 'good' | 'bad' }) {
  const activeStyles: Record<string, { bg: string; color: string }> = {
    neutral: { bg: '#1F1F1F', color: '#fff' },
    good: { bg: '#E1F5EE', color: '#085041' },
    bad: { bg: '#FAECE7', color: '#993C1D' },
  };
  const style = active ? activeStyles[tone] : { bg: '#f0f0f0', color: '#666' };
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 14px',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: style.bg,
        color: style.color,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function MiniKpi({
  label,
  value,
  valueColor = '#1a1a1a',
  pill,
  note,
}: {
  label: string;
  value: string;
  valueColor?: string;
  pill?: { text: string; tone: 'teal' | 'coral' | 'amber' | 'neutral' };
  /** Подпись без плашки — как «дают 80% прибыли» в прототипе. */
  note?: string;
}) {
  const toneStyles: Record<string, { bg: string; color: string }> = {
    teal: { bg: '#E1F5EE', color: '#085041' },
    coral: { bg: '#FAECE7', color: '#712B13' },
    amber: { bg: '#FAEEDA', color: '#854F0B' },
    neutral: { bg: '#F1EFE8', color: '#5F5E5A' },
  };
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: valueColor, lineHeight: 1 }}>{value}</div>
      {pill && (
        <span
          style={{
            fontSize: 10.5,
            background: toneStyles[pill.tone].bg,
            color: toneStyles[pill.tone].color,
            padding: '1px 6px',
            borderRadius: 4,
            display: 'inline-block',
            marginTop: 5,
          }}
        >
          {pill.text}
        </span>
      )}
      {!pill && note && <div style={{ fontSize: 10.5, color: '#888', marginTop: 5 }}>{note}</div>}
    </div>
  );
}

function AbcGroup({ label, count, pct, bg, color, sub }: { label: string; count: number; pct: number; bg: string; color: string; sub: string }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 500, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10.5, color: sub, marginTop: 5 }}>{label}</div>
      {/* Доли теперь считаются, а не заданы вручную — округляем на выводе */}
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{Math.round(pct)}% прибыли</div>
    </div>
  );
}
