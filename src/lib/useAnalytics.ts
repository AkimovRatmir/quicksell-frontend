import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import type { MonthlySeries, ProfitSummary } from '../types/api';
import { effectiveMonth, previousMonth, type PeriodSelection } from './period';

interface AnalyticsState {
  profit: ProfitSummary | null;
  monthly: MonthlySeries | null;
  isLoading: boolean;
  error: string | null;
  /**
   * true — цифры собраны из помесячного ряда (режим «Отчёт»). Разбивка по
   * статьям расходов и счётчики заказов в этом режиме недоступны: бэкенд
   * отдаёт их только для скользящего периода.
   */
  derived: boolean;
  reload: () => void;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Собирает сводку за календарный месяц из помесячного ряда.
 *
 * GET /profit принимает только `period` (7d|30d|90d|12m) — произвольного
 * диапазона дат у бэкенда нет, поэтому «Отчёт» строится на /monthly.
 * Для текущего месяца этот ряд по определению покрывает 1-е → сегодня,
 * что и есть режим «Сейчас».
 */
function summaryFromMonthly(monthly: MonthlySeries, month: string): ProfitSummary | null {
  const point = monthly.data.find((d) => d.month === month);
  if (!point) return null;
  const prev = monthly.data.find((d) => d.month === previousMonth(month));
  const revenue = point.revenue;
  return {
    period: month,
    from: `${month}-01`,
    to: month,
    revenue,
    cogs: point.cogs,
    operatingExpenses: point.operatingExpenses,
    netProfit: point.profit,
    marginPct: revenue > 0 ? (point.profit / revenue) * 100 : 0,
    expensesShareOfRevenuePct: revenue > 0 ? (point.operatingExpenses / revenue) * 100 : 0,
    orders: 0,
    unitsSold: 0,
    composition: { netProfit: point.profit, cogs: point.cogs, operatingExpenses: point.operatingExpenses },
    expensesByCategory: [],
    comparison: {
      revenuePct: prev ? pctChange(revenue, prev.revenue) : null,
      netProfitPct: prev ? pctChange(point.profit, prev.profit) : null,
      expensesPct: prev ? pctChange(point.operatingExpenses, prev.operatingExpenses) : null,
    },
    dataQuality: { unitsMissingCost: 0, costCoveragePct: 100 },
  };
}

/** Грузит сводку прибыли под выбранный режим топбара плюс помесячный ряд. */
export function useAnalytics(sellerId: string | null, selection: PeriodSelection): AnalyticsState {
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlySeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [derived, setDerived] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const selectionKey =
    selection.mode === 'period' ? `p:${selection.period}` : `r:${effectiveMonth(selection)}:${selection.range}`;

  useEffect(() => {
    if (!sellerId) {
      setProfit(null);
      setMonthly(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const monthlyPromise = analyticsApi.getMonthly(sellerId, 12);

    monthlyPromise
      .then((series) => {
        if (!cancelled) setMonthly(series);
      })
      .catch(() => {
        if (!cancelled) setMonthly(null);
      });

    const run = async () => {
      if (selection.mode === 'period') {
        const summary = await analyticsApi.getProfit(sellerId, { period: selection.period });
        return { summary, derived: false };
      }
      const series = await monthlyPromise;
      const month = effectiveMonth(selection);
      const summary = summaryFromMonthly(series, month);
      if (summary) return { summary, derived: true };
      // Месяца нет в 12-месячном окне — показываем пустой отчёт, а не чужие цифры.
      return { summary: summaryFromMonthly({ months: 1, data: [{ month, revenue: 0, cogs: 0, operatingExpenses: 0, profit: 0 }] }, month)!, derived: true };
    };

    run()
      .then(({ summary, derived: isDerived }) => {
        if (cancelled) return;
        setProfit(summary);
        setDerived(isDerived);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(extractErrorMessage(err, 'Не удалось загрузить аналитику прибыли'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, selectionKey, reloadKey]);

  return { profit, monthly, isLoading, error, derived, reload };
}
