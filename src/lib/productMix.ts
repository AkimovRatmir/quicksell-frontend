import { analyticsApi } from '../api/analytics';
import type { AnalyticsPeriod, ProductSales } from '../types/api';

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

export interface ProductMix {
  /** Все SKU с продажами за период, по убыванию прибыли (порядок бэкенда). */
  rows: ProductSales[];
  total: number;
  /** true — список длиннее, чем удалось прочитать за отведённые страницы. */
  truncated: boolean;
}

/**
 * Читает продажи по всем SKU за период. Нужен целиком: и концентрация прибыли,
 * и ABC-группы, и лидеры оборачиваемости считаются по всему ассортименту,
 * а не по странице таблицы, у которой свои фильтр и поиск.
 */
export async function loadProductMix(sellerId: string, period: AnalyticsPeriod): Promise<ProductMix> {
  const rows: ProductSales[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await analyticsApi.getProductStats(sellerId, { period, filter: 'all', page, limit: PAGE_SIZE });
    total = res.total;
    rows.push(...res.data);
    if (res.data.length === 0 || rows.length >= total) break;
  }
  return { rows, total, truncated: rows.length < total };
}

export interface AbcGroup {
  count: number;
  /** Какую долю прибыли забирает группа, %. */
  sharePct: number;
}

export interface AbcBreakdown {
  a: AbcGroup;
  b: AbcGroup;
  c: AbcGroup;
  /** Убыточные SKU: в накопление прибыли не входят, но в группе C их видно. */
  lossCount: number;
}

/**
 * Классический ABC по накопленной доле прибыли: A — товары, дающие первые 80%,
 * B — следующие 15%, C — оставшиеся 5%.
 *
 * Убыточные позиции в накопление не идут: их вклад отрицательный, и, попав в
 * знаменатель, они завысили бы доли всех остальных. Считаем их частью группы C —
 * прибыли они не приносят.
 */
export function classifyAbc(rows: ProductSales[]): AbcBreakdown | null {
  const profitable = rows.filter((r) => r.profit > 0).sort((a, b) => b.profit - a.profit);
  const lossCount = rows.filter((r) => r.profit <= 0).length;
  const totalProfit = profitable.reduce((sum, r) => sum + r.profit, 0);
  if (totalProfit <= 0) return null;

  const group = { a: { count: 0, profit: 0 }, b: { count: 0, profit: 0 }, c: { count: 0, profit: 0 } };
  let acc = 0;
  for (const row of profitable) {
    // Товар относим к группе по доле, накопленной ДО него: иначе первый же
    // крупный SKU, перешагивающий 80%, оказывался бы в B вместе с мелочью.
    const before = acc / totalProfit;
    const key = before < 0.8 ? 'a' : before < 0.95 ? 'b' : 'c';
    group[key].count += 1;
    group[key].profit += row.profit;
    acc += row.profit;
  }

  const share = (v: number) => (v / totalProfit) * 100;
  return {
    a: { count: group.a.count, sharePct: share(group.a.profit) },
    b: { count: group.b.count, sharePct: share(group.b.profit) },
    c: { count: group.c.count + lossCount, sharePct: share(group.c.profit) },
    lossCount,
  };
}

/** Лидеры по оборачиваемости — больше всего проданных единиц за период. */
export function turnoverTop(rows: ProductSales[], limit = 3): ProductSales[] {
  return [...rows]
    .filter((r) => r.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}
