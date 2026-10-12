import { apiClient, SKIP_AUTH_REDIRECT_HEADER } from './client';
import type {
  ActiveOrdersResponse,
  ConnectResult,
  CreateSellerPayload,
  OrderListParams,
  OrderListResponse,
  OrderSyncResult,
  Product,
  ProductListParams,
  ProductListResponse,
  Seller,
  SyncResult,
  UpdateProductPayload,
  UpdateSellerPayload,
  VerifyCodePayload,
} from '../types/api';

// A 401 from these two endpoints means Kaspi rejected the seller's
// login/password (or the stored Kaspi session expired) — not that our own
// app session is invalid, so it must not trigger a global logout.
const skipAuthRedirect = { headers: { [SKIP_AUTH_REDIRECT_HEADER]: '1' } };

export const kaspiApi = {
  listSellers: () => apiClient.get<Seller[]>('/kaspi/sellers').then((r) => r.data),

  /**
   * Подключает магазин по логину и паролю кабинета. Kaspi требует код с почты
   * на новом устройстве, поэтому ответ либо `connected`, либо `mfa_required`
   * с pendingId — тогда подключение завершает verifyCode.
   */
  createSeller: (payload: CreateSellerPayload) =>
    apiClient.post<ConnectResult>('/kaspi/sellers', payload, skipAuthRedirect).then((r) => r.data),

  /** Завершает подключение кодом из письма. После этого устройство доверенное — код больше не спросят. */
  verifyCode: (payload: VerifyCodePayload) =>
    apiClient.post<ConnectResult>('/kaspi/sellers/verify-code', payload, skipAuthRedirect).then((r) => r.data),

  /** Просит Kaspi прислать код заново. Kaspi ограничивает частоту — 400 при спаме. */
  resendCode: (pendingId: string) =>
    apiClient
      .post<{ emailSentTo: string }>('/kaspi/sellers/resend-code', { pendingId }, skipAuthRedirect)
      .then((r) => r.data),

  /** Повторный вход по сохранённому логину, когда сессия протухла. Может снова запросить код. */
  reauth: (sellerId: string) =>
    apiClient.post<ConnectResult>(`/kaspi/sellers/${sellerId}/reauth`, undefined, skipAuthRedirect).then((r) => r.data),

  sync: (sellerId: string) =>
    apiClient.post<SyncResult>(`/kaspi/sellers/${sellerId}/sync`, undefined, skipAuthRedirect).then((r) => r.data),

  // Add/rotate credentials on an existing seller — used to attach a Kaspi API
  // token later if it was skipped during registration.
  updateSeller: (sellerId: string, payload: UpdateSellerPayload) =>
    apiClient.patch<Seller>(`/kaspi/sellers/${sellerId}`, payload, skipAuthRedirect).then((r) => r.data),

  // Orders power revenue/profit analytics — a separate pipeline from the product
  // sync above, gated on the Kaspi API token captured at registration (step 2).
  // Kicked off once from the registration wizard so «Прибыль и расходы» has data.
  backfillOrders: (sellerId: string) =>
    apiClient
      .post<OrderSyncResult>(`/kaspi/sellers/${sellerId}/orders/backfill`, undefined, skipAuthRedirect)
      .then((r) => r.data),

  listProducts: (sellerId: string, params: ProductListParams = {}) =>
    apiClient
      .get<ProductListResponse>(`/kaspi/sellers/${sellerId}/products`, { params })
      .then((r) => r.data),

  listOrders: (sellerId: string, params: OrderListParams = {}) =>
    apiClient
      .get<OrderListResponse>(`/kaspi/sellers/${sellerId}/orders`, { params })
      .then((r) => r.data),

  /**
   * Живой список активных (не архивных) заказов: NEW, SIGN_REQUIRED, PICKUP,
   * DELIVERY, KASPI_DELIVERY. Синхронизация кладёт в базу только ARCHIVE, а
   * заказ доезжает до архива в среднем за 2.8 дня — без этого вызова последние
   * дни выглядят пустыми.
   *
   * Фильтров и постраничности нет: Kaspi отдаёт всё активное разом.
   * 401 здесь — протухший API-токен продавца, а не наша сессия, поэтому
   * глобальный разлогин подавляем.
   */
  listActiveOrders: (sellerId: string) =>
    apiClient
      .get<ActiveOrdersResponse>(`/kaspi/sellers/${sellerId}/active-orders`, skipAuthRedirect)
      .then((r) => r.data),

  updateProduct: (sellerId: string, sku: string, payload: UpdateProductPayload) =>
    apiClient
      .patch<Product>(`/kaspi/sellers/${sellerId}/products/${encodeURIComponent(sku)}`, payload)
      .then((r) => r.data),
};
