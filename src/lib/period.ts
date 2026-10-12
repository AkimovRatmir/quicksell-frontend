import type { AnalyticsPeriod } from '../types/api';

/**
 * Топбар умеет два режима выборки данных:
 *  - «Период» — скользящее окно: 7 / 30 / 90 дней или 12 месяцев. Считает бэкенд.
 *  - «Отчёт»  — календарная выборка: либо выбранный месяц целиком (1-е → конец
 *               месяца), либо «Сейчас» — текущий месяц с 1-го по сегодня.
 *               В режиме «Сейчас» месяц всегда текущий, выбор месяца не нужен.
 */
export type PeriodSelection =
  | { mode: 'period'; period: AnalyticsPeriod }
  | { mode: 'report'; month: string; range: 'full' | 'mtd' };

export const DEFAULT_SELECTION: PeriodSelection = { mode: 'period', period: '30d' };

const MONTH_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  '7d': 'за 7 дней',
  '30d': 'за 30 дней',
  '90d': 'за 90 дней',
  '12m': 'за 12 месяцев',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM" для даты. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** Последние `count` месяцев, начиная с текущего и вглубь: ["2026-08", "2026-07", …]. */
export function recentMonths(count = 12, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

/** "2026-05" → "Май 2026". */
export function formatMonthTitle(key: string): string {
  const [year, month] = key.split('-');
  const idx = Number(month) - 1;
  return `${MONTH_NOMINATIVE[idx] ?? key} ${year}`;
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Месяц, данные за который нужно показать. В режиме «Сейчас» это всегда
 * текущий месяц, каким бы ни был выбор в выпадающем списке.
 */
export function effectiveMonth(selection: Extract<PeriodSelection, { mode: 'report' }>, now = new Date()): string {
  return selection.range === 'mtd' ? monthKey(now) : selection.month;
}

/** Границы отчёта в виде "YYYY-MM-DD" включительно. */
export function reportBounds(month: string, range: 'full' | 'mtd', now = new Date()): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const lastDay = daysInMonth(month);
  const isCurrent = month === monthKey(now);
  const lastIncluded = range === 'mtd' && isCurrent ? Math.min(now.getDate(), lastDay) : lastDay;
  return { from: `${year}-${pad(m)}-01`, to: `${year}-${pad(m)}-${pad(lastIncluded)}` };
}

/** Подпись выборки для заголовков карточек: «за 30 дней», «за май 2026», «1–6 августа». */
export function selectionLabel(selection: PeriodSelection, now = new Date()): string {
  if (selection.mode === 'period') return PERIOD_LABELS[selection.period];
  if (selection.range === 'mtd') {
    return `1–${now.getDate()} ${MONTH_GENITIVE[now.getMonth()]}`;
  }
  const [year, m] = selection.month.split('-').map(Number);
  return `за ${MONTH_NOMINATIVE[m - 1].toLowerCase()} ${year}`;
}

/** Короткая подпись для сравнения с предыдущим отрезком. */
export function previousMonth(key: string): string {
  const [year, m] = key.split('-').map(Number);
  return monthKey(new Date(year, m - 2, 1));
}
