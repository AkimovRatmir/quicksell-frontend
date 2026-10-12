import { kaspiApi } from '../api/kaspi';
import type { Product } from '../types/api';

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

export interface CatalogSnapshot {
  items: Product[];
  /** Сколько всего товаров у продавца по данным Kaspi. */
  total: number;
  /** true — каталог больше, чем удалось прочитать (упёрлись в лимит страниц). */
  truncated: boolean;
}

/**
 * Читает весь каталог постранично. Нужен там, где считать надо по всем товарам,
 * а не по текущей странице: KPI, полоса готовности, фильтры «Топ»/«Слабые».
 */
export async function loadCatalog(sellerId: string, search?: string): Promise<CatalogSnapshot> {
  const items: Product[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await kaspiApi.listProducts(sellerId, { page, limit: PAGE_SIZE, search: search || undefined });
    total = res.total;
    items.push(...res.data);
    if (res.data.length === 0 || items.length >= res.total) break;
  }
  return { items, total, truncated: items.length < total };
}
