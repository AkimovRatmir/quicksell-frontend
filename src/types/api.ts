/** Тарифный план аккаунта. Приходит из GET /auth/me и решает, что показывать. */
export type Plan = 'free' | 'pro';

/** Роль доступа. 'admin' открывает админ-панель. */
export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  plan?: Plan;
  /** Конец оплаченного Pro. null у Pro — бессрочный (выдан из админки). */
  planExpiresAt?: string | null;
  role?: Role;
  createdAt?: string;
}

// --- Оплата подписки (FreedomPay) ---

/** POST /billing/checkout: платёж создан, paymentUrl — форма FreedomPay для попапа. */
export interface CheckoutResponse {
  paymentId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed';

/** GET /billing/payments/:id — пока pending, бэкенд сам спрашивает FreedomPay. */
export interface PaymentInfo {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt: string | null;
  /** До какого числа теперь действует Pro. */
  paidUntil: string | null;
  failureReason: string | null;
  createdAt: string;
}

// --- Админ-панель (только для role='admin') ---

export interface AdminOverview {
  users: { total: number; new7d: number; new30d: number; free: number; pro: number; admins: number };
  sellers: { total: number; needsReauth: number; withErrors: number; ok: number };
  data: { orders: number; products: number; gmvCompleted: number; unitEconomicsCalcs: number };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  role: Role;
  createdAt: string;
  sellerCount: number;
}

export interface AdminUsersResponse {
  total: number;
  page: number;
  limit: number;
  data: AdminUserRow[];
}

export interface AdminUserSeller {
  id: string;
  name: string;
  kaspiMerchantUid: string;
  cookieStatus: CookieStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  orders: number;
  products: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  role: Role;
  createdAt: string;
  sellers: AdminUserSeller[];
  usage: { sellers: number; unitEconomicsCalcs: number };
}

export interface AdminSellerRow {
  id: string;
  name: string;
  kaspiMerchantUid: string;
  cookieStatus: CookieStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  orders: number;
}

export interface AdminSellersResponse {
  total: number;
  page: number;
  limit: number;
  data: AdminSellerRow[];
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Юридические документы, под которыми пользователь ставит галочку. */
export type LegalDocCode = 'oferta' | 'policy' | 'payment';

export interface LegalDocument {
  code: LegalDocCode;
  version: string;
  title?: string;
  url?: string;
  publishedAt?: string;
}

/** Что именно принял пользователь: код документа и его версия на момент согласия. */
export interface AcceptedDocument {
  code: LegalDocCode;
  version: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  /** Галочка на регистрации. Бэкенд принимает только true. */
  acceptedTerms: boolean;
  /** Версии документов на момент согласия. Не отправляем, если список недоступен. */
  acceptedDocuments?: AcceptedDocument[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

/**
 * Ответ на запрос восстановления. Сообщение показываем как есть: бэкенд
 * намеренно отвечает одинаково и для существующей, и для незнакомой почты.
 */
export interface ForgotPasswordResponse {
  message?: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

/** Проверка ссылки из письма до показа формы. */
export interface ResetTokenCheck {
  valid?: boolean;
  email?: string;
  message?: string;
}

export type CookieStatus = 'ok' | 'needs_reauth' | string;

export interface Seller {
  id: string;
  userId: string;
  name: string;
  kaspiMerchantUid: string;
  cookieStatus: CookieStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerPayload {
  name: string;
  kaspiMerchantUid?: string;
  kaspiLogin?: string;
  kaspiPassword?: string;
  kaspiSessionCookie?: string;
  kaspiApiToken?: string;
}

/**
 * Ответ на подключение или повторный вход. Kaspi теперь требует код с почты
 * на каждом новом устройстве: если сессия не восстановилась молча, бэкенд
 * возвращает `mfa_required`, и подключение продолжается через verify-code.
 */
export type ConnectResult =
  | { status: 'connected'; seller: Seller }
  | { status: 'mfa_required'; pendingId: string; emailSentTo: string };

export interface VerifyCodePayload {
  pendingId: string;
  code: string;
}

export interface SyncResult {
  sellerId: string;
  total: number;
  fetched: number;
  upserted: number;
  archived: number;
}

export interface UpdateSellerPayload {
  name?: string;
  kaspiApiToken?: string;
  kaspiLogin?: string;
  kaspiPassword?: string;
  kaspiSessionCookie?: string;
}

/** Result of a Kaspi order backfill/sync — revenue & profit analytics are computed from these orders. */
export interface OrderSyncResult {
  sellerId: string;
  orders: number;
  entries: number;
}

export interface OrderListParams {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface KaspiOrder {
  code: string;
  state: string;
  status: string;
  totalPrice: number;
  deliveryCostForSeller: number;
  paymentMode: string;
  deliveryMode: string;
  isKaspiDelivery: boolean;
  customerName: string;
  deliveryTown: string;
  entriesCount: number;
  creationDate: string;
  completionDate: string | null;
}

export interface OrderListResponse {
  total: number;
  page: number;
  limit: number;
  data: KaspiOrder[];
}

/**
 * Активный заказ приходит живьём из Kaspi и полей у него меньше, чем у
 * архивного: ни стоимости доставки, ни города, ни даты завершения ещё нет.
 */
export interface KaspiActiveOrder {
  code: string;
  /** NEW · SIGN_REQUIRED · PICKUP · DELIVERY · KASPI_DELIVERY */
  state: string;
  status: string;
  totalPrice: number;
  deliveryMode: string;
  isKaspiDelivery: boolean;
  customerName: string;
  plannedDeliveryDate: string | null;
  creationDate: string;
}

export interface ActiveOrdersResponse {
  totalActive: number;
  byState: Record<string, number>;
  data: KaspiActiveOrder[];
}

export type AiTone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface AiTag {
  label: string;
  tone: AiTone;
}

export interface AiActionItem {
  title: string;
  detail: string;
  badge?: string | null;
  tone: AiTone;
}

export interface AiGrowthPoint {
  title: string;
  detail: string;
  /** Оценка выгоды. Модель иногда пишет «Не указано» — это не значение. */
  potential?: string | null;
  tone: AiTone;
}

/**
 * Оценка состояния бизнеса одним-двумя словами («стабилен», «под давлением»).
 * Тон приходит от модели, а не выводится на фронте по словарю: подсветить
 * зелёным или красным нужно ровно тот смысл, который она вложила.
 */
export interface AiVerdict {
  label: string;
  tone: 'positive' | 'negative';
}

/** Разделы AI-инсайта: один ответ покрывает все страницы сразу. */
export interface AiInsights {
  period: string;
  /** `verdict.label` встречается внутри `text` — по нему и подсвечиваем. */
  headline: { verdict: AiVerdict; text: string; tags: AiTag[] };
  /** Главная → «Требуют действий». Максимум 3. */
  requiresAction: AiActionItem[];
  /** Главная → «Точки роста». Всегда 3. */
  growthPoints: AiGrowthPoint[];
  /** «Прибыль и расходы» → блок «Прибыль». */
  profitInsight: { text: string };
  /** «Прибыль и расходы» → блок «Расходы». */
  expensesInsight: { text: string };
  /** «Товарная статистика» → 1-2 предложения свободным текстом. */
  productsInsight: { text: string };
}

export interface AiInsightsResponse {
  generatedAt: string;
  model: string;
  period: string;
  insights: AiInsights;
  /** Цифры, на которых модель строила выводы — по ним видно, не устарел ли инсайт. */
  basedOn?: {
    revenue: number;
    cogs: number;
    operatingExpenses: number;
    netProfit: number;
    marginPct: number;
    expensesShareOfRevenuePct: number;
    orders: number;
    unitsSold: number;
  };
}

export type ProductStatsFilter = 'all' | 'top' | 'weak';

/** Бейдж товара в карточке: считает бэкенд по прибыли с единицы. */
export type ProductStatus = 'loss' | 'low_margin' | 'profitable';

export interface PriceHistoryEntry {
  price: number;
  observedAt: string;
  /** order — цена реальной продажи; kaspi_sync — цена на витрине при синхронизации. */
  source: 'order' | 'kaspi_sync' | string;
  changeFromPrev: number | null;
  isCurrent: boolean;
}

export interface CostHistoryEntry {
  id: string;
  cost: number;
  /** С этой даты себестоимость применяется к заказам; прошлые считаются по предыдущей записи. */
  effectiveFrom: string;
  changeFromPrev: number | null;
  /** Последняя запись, которая уже вступила в силу — дата может быть и будущей. */
  isCurrent: boolean;
}

/**
 * Карточка товара: цена на витрине, текущая себестоимость и обе истории.
 * unitProfit здесь — что принесёт ещё одна продажа по текущей цене за вычетом
 * категорий расходов и налога; это не средняя прибыль из товарной статистики.
 */
export interface ProductCard {
  sku: string;
  title: string;
  listedPrice: number | null;
  costPrice: number | null;
  available: boolean;
  totalStock: number;
  archivedAt: string | null;
  unitProfit: number | null;
  marginPct: number | null;
  expensesPerUnit: number | null;
  status: ProductStatus | null;
  priceHistory: PriceHistoryEntry[];
  costHistory: CostHistoryEntry[];
}

export interface CostEntryPayload {
  cost: number;
  /** ISO-дата. По умолчанию — сейчас. */
  effectiveFrom?: string;
}

/**
 * Продажи по одному SKU за период. Каталог (`/products`) таких данных не даёт —
 * их считает бэкенд по позициям заказов.
 */
export interface ProductSales {
  sku: string;
  title: string;
  /** Продано штук за период. */
  units: number;
  revenue: number;
  profit: number;
  marginPct: number | null;
  /** Доля товара в общей прибыли за период, %. */
  profitSharePct: number | null;
  /** Доля возвратов, %. null — данных о возвратах нет. */
  returnsPct: number | null;
  /** Изменение к прошлому периоду, %. null — сравнивать не с чем. */
  trendPct: number | null;
  /** true — себестоимость не заполнена, прибыль и маржа неполные. */
  costMissing: boolean;
}

export interface ProductStatsResponse {
  period: AnalyticsPeriod;
  /** Границы периода, посчитанные бэкендом. */
  from?: string;
  to?: string;
  filter?: ProductStatsFilter;
  total: number;
  page: number;
  limit: number;
  totals: { revenue: number; profit: number; units: number };
  data: ProductSales[];
}

export interface ProductStatsQuery {
  period?: AnalyticsPeriod;
  filter?: ProductStatsFilter;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductAvailability {
  storeId: string;
  stockCount: number;
  available: 'yes' | 'no' | string;
}

export interface Product {
  sku: string;
  title: string;
  brand: string | null;
  masterCategory: string | null;
  priceMin: number;
  priceMax: number;
  costPrice: number | null;
  available: boolean;
  totalStock: number;
  availabilities: ProductAvailability[];
  archivedAt: string | null;
  kaspiUpdatedAt: string;
  syncedAt: string;
}

export interface ProductListParams {
  search?: string;
  available?: 'true' | 'false';
  archived?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  total: number;
  page: number;
  limit: number;
  data: Product[];
}

export interface UpdateProductPayload {
  costPrice: number | null;
}

export interface ApiErrorBody {
  message: string | string[];
  error?: string;
  statusCode: number;
}

/** Backend keys: 7d = 7 days, 30d = ~month, 90d = ~quarter, 12m = 12 months.
 *  Anything else silently falls back to 30 days — so these MUST match exactly. */
export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m';

/** Запрос сводки прибыли: либо скользящий период, либо явный диапазон дат (режим «Отчёт»). */
export interface ProfitQuery {
  period?: AnalyticsPeriod;
  /** "YYYY-MM-DD" включительно */
  from?: string;
  /** "YYYY-MM-DD" включительно */
  to?: string;
}

export interface ExpenseCategoryBreakdown {
  key: string;
  label: string;
  color: string;
  amount: number;
  share: number;
}

export interface ProfitComparison {
  revenuePct: number | null;
  netProfitPct: number | null;
  expensesPct: number | null;
}

export interface ProfitDataQuality {
  unitsMissingCost: number;
  costCoveragePct: number;
}

export interface ProfitSummary {
  period: string;
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
  marginPct: number;
  expensesShareOfRevenuePct: number;
  orders: number;
  unitsSold: number;
  composition: { netProfit: number; cogs: number; operatingExpenses: number };
  expensesByCategory: ExpenseCategoryBreakdown[];
  comparison: ProfitComparison;
  dataQuality: ProfitDataQuality;
}

export interface MonthlyPoint {
  month: string; // "YYYY-MM"
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  profit: number;
}

export interface MonthlySeries {
  months: number;
  data: MonthlyPoint[];
}

export interface AnalyticsGoals {
  targetProfitPct: number;
  minProfitPct: number;
  paybackMonths: number;
}

export type ExpenseCategoryKind = 'percent' | 'fixed';

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: ExpenseCategoryKind;
  value: number;
  color: string;
  sortOrder: number;
}

export interface AnalyticsSettings {
  applyExpensesAuto: boolean;
  taxPercent: number;
  goals: AnalyticsGoals;
  updatedAt: string;
  expenseCategories: ExpenseCategory[];
}

export interface UpdateAnalyticsSettingsPayload {
  applyExpensesAuto?: boolean;
  targetProfitPct?: number;
  minProfitPct?: number;
  taxPercent?: number;
  paybackMonths?: number;
}

export interface CreateExpenseCategoryPayload {
  name: string;
  kind: ExpenseCategoryKind;
  value: number;
  color?: string;
}

export interface UpdateExpenseCategoryPayload {
  name?: string;
  kind?: ExpenseCategoryKind;
  value?: number;
  color?: string;
}

export interface BulkCostPayload {
  cost: number;
  onlyUnfilled?: boolean;
}

export interface BulkCostResult {
  updated: number;
}

/**
 * Себестоимость как доля цены продажи: percent = 60 → себестоимость 60% от цены,
 * прибыль — оставшиеся 40%. Бэкенд сам пересчитывает цену каждого SKU в тенге.
 */
export interface BulkCostPercentPayload {
  percent: number;
  onlyUnfilled?: boolean;
}

export interface BulkCostPercentResult {
  updated: number;
  percent: number;
}

export interface UnitEconomicsPayload {
  salePrice: number;
  costPrice?: number;
  kaspiCommissionPct?: number;
  deliveryToCustomer?: number;
  deliveryToWarehouse?: number;
  packaging?: number;
  advertisingPerUnit?: number;
  returnsPct?: number;
  otherExpenses?: number;
  salesPerMonth?: number;
  targetMarginPct?: number;
}

export interface UnitEconomicsResult {
  totalCostPerUnit: number;
  profitPerUnit: number;
  marginPct: number;
  /** null — себестоимость и расходы нулевые, ROI делить не на что. */
  roiPct: number | null;
  monthlyProfit: number;
  /** null — целевая маржа недостижима при таких расходах ни при какой цене. */
  recommendedPrice: number | null;
}

export interface UnitEconomicsCostItem {
  key: string;
  label: string;
  amount: number;
  share: number;
}

/** Лимит бесплатных расчётов в месяц — приходит вместе с результатом. */
export interface UnitEconomicsUsage {
  plan: Plan;
  /** null — на Pro лимита нет. */
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface UnitEconomicsRecord {
  id: string;
  result: UnitEconomicsResult;
  costStructure: UnitEconomicsCostItem[];
  usage?: UnitEconomicsUsage;
  /** Вводные расчёта. Бэкенд отдаёт поле как `inputs` — с `input` карточки истории были пустыми. */
  inputs?: UnitEconomicsPayload;
  createdAt?: string;
}
