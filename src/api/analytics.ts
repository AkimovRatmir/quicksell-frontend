import { apiClient } from './client';
import type {
  AiInsightsResponse,
  AnalyticsSettings,
  ProfitQuery,
  BulkCostPayload,
  BulkCostPercentPayload,
  BulkCostPercentResult,
  BulkCostResult,
  CostEntryPayload,
  CreateExpenseCategoryPayload,
  ExpenseCategory,
  MonthlySeries,
  ProductCard,
  ProductStatsQuery,
  ProductStatsResponse,
  ProfitSummary,
  UnitEconomicsPayload,
  UnitEconomicsRecord,
  UnitEconomicsUsage,
  UpdateAnalyticsSettingsPayload,
  UpdateExpenseCategoryPayload,
} from '../types/api';

export const analyticsApi = {
  // `query` — либо { period }, либо { from, to } для режима «Отчёт».
  getProfit: (sellerId: string, query: ProfitQuery) =>
    apiClient.get<ProfitSummary>(`/analytics/sellers/${sellerId}/profit`, { params: query }).then((r) => r.data),

  getMonthly: (sellerId: string, months = 12) =>
    apiClient.get<MonthlySeries>(`/analytics/sellers/${sellerId}/monthly`, { params: { months } }).then((r) => r.data),

  /**
   * Продажи в разрезе SKU за период. Отдельный вызов, а не поле каталога:
   * каталог берётся из Postgres, а эти цифры считаются по позициям заказов.
   * Фильтр «Все/Топ/Слабые», поиск и постраничность считает бэкенд.
   */
  getProductStats: (sellerId: string, params: ProductStatsQuery) =>
    apiClient
      .get<ProductStatsResponse>(`/analytics/sellers/${sellerId}/product-stats`, { params })
      .then((r) => r.data),

  /**
   * Генерирует AI-инсайт сразу для всех страниц одним ответом. Вызов платный
   * и небыстрый (ходит в OpenAI), поэтому дёргать его напрямую из страниц
   * нельзя — только через AiInsightsProvider, который держит один результат
   * на весь сеанс работы с выбранным периодом.
   */
  generateAiInsights: (sellerId: string, period: string, force = false) =>
    apiClient
      .post<AiInsightsResponse>(`/analytics/sellers/${sellerId}/ai-insights`, undefined, {
        params: force ? { period, force: true } : { period },
      })
      .then((r) => r.data),

  getSettings: (sellerId: string) =>
    apiClient.get<AnalyticsSettings>(`/analytics/sellers/${sellerId}/settings`).then((r) => r.data),

  updateSettings: (sellerId: string, payload: UpdateAnalyticsSettingsPayload) =>
    apiClient.patch<AnalyticsSettings>(`/analytics/sellers/${sellerId}/settings`, payload).then((r) => r.data),

  listExpenseCategories: (sellerId: string) =>
    apiClient.get<ExpenseCategory[]>(`/analytics/sellers/${sellerId}/expense-categories`).then((r) => r.data),

  addExpenseCategory: (sellerId: string, payload: CreateExpenseCategoryPayload) =>
    apiClient.post<ExpenseCategory>(`/analytics/sellers/${sellerId}/expense-categories`, payload).then((r) => r.data),

  updateExpenseCategory: (sellerId: string, categoryId: string, payload: UpdateExpenseCategoryPayload) =>
    apiClient
      .patch<ExpenseCategory>(`/analytics/sellers/${sellerId}/expense-categories/${categoryId}`, payload)
      .then((r) => r.data),

  deleteExpenseCategory: (sellerId: string, categoryId: string) =>
    apiClient.delete<void>(`/analytics/sellers/${sellerId}/expense-categories/${categoryId}`).then((r) => r.data),

  bulkCost: (sellerId: string, payload: BulkCostPayload) =>
    apiClient.post<BulkCostResult>(`/analytics/sellers/${sellerId}/products/cost/bulk`, payload).then((r) => r.data),

  /** Проставить себестоимость как процент от цены продажи каждого SKU. */
  bulkCostPercent: (sellerId: string, payload: BulkCostPercentPayload) =>
    apiClient
      .post<BulkCostPercentResult>(`/analytics/sellers/${sellerId}/products/cost/bulk-percent`, payload)
      .then((r) => r.data),

  /** Карточка товара: цена, себестоимость и обе истории одним запросом. */
  getProductCard: (sellerId: string, sku: string) =>
    apiClient.get<ProductCard>(`/analytics/sellers/${sellerId}/products/${encodeURIComponent(sku)}/card`).then((r) => r.data),

  /**
   * Добавить запись себестоимости, действующую с даты. Заказы после этой даты
   * считаются по новой, до неё — по предыдущей. Возвращает обновлённую карточку.
   */
  addCostEntry: (sellerId: string, sku: string, payload: CostEntryPayload) =>
    apiClient
      .post<ProductCard>(`/analytics/sellers/${sellerId}/products/${encodeURIComponent(sku)}/cost`, payload)
      .then((r) => r.data),

  updateCostEntry: (sellerId: string, sku: string, entryId: string, payload: Partial<CostEntryPayload>) =>
    apiClient
      .patch<ProductCard>(`/analytics/sellers/${sellerId}/products/${encodeURIComponent(sku)}/cost/${entryId}`, payload)
      .then((r) => r.data),

  /** Удалить запись. Без единой записи товар возвращается в «не заполнено». */
  deleteCostEntry: (sellerId: string, sku: string, entryId: string) =>
    apiClient
      .delete<ProductCard>(`/analytics/sellers/${sellerId}/products/${encodeURIComponent(sku)}/cost/${entryId}`)
      .then((r) => r.data),

  /** Считает и сохраняет расчёт юнит-экономики. В ответе — результат, структура затрат и лимит тарифа. */
  saveUnitEconomics: (sellerId: string, payload: UnitEconomicsPayload) =>
    apiClient.post<UnitEconomicsRecord>(`/analytics/sellers/${sellerId}/unit-economics`, payload).then((r) => r.data),

  // История приходит с остатком лимита — по нему страница ещё до первого
  // расчёта знает, сколько осталось, а не показывает общую фразу.
  listUnitEconomics: (sellerId: string, limit = 12) =>
    apiClient
      .get<UnitEconomicsRecord[] | { data: UnitEconomicsRecord[]; usage?: UnitEconomicsUsage }>(
        `/analytics/sellers/${sellerId}/unit-economics`,
        { params: { limit } },
      )
      .then((r) =>
        Array.isArray(r.data) ? { data: r.data, usage: null } : { data: r.data?.data ?? [], usage: r.data?.usage ?? null },
      ),
};
