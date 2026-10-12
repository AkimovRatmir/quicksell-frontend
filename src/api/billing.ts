import { apiClient } from './client';
import type { CheckoutResponse, PaymentInfo } from '../types/api';

/**
 * Сообщение, которое страница возврата (/payment/return внутри попапа)
 * шлёт родительскому окну, когда FreedomPay закончил. Это только сигнал
 * «проверь сейчас» — результат всегда берём у бэкенда.
 */
export const PAYMENT_RETURN_MESSAGE = 'quicksell:payment-return';

export const billingApi = {
  /**
   * Создаёт платёж за Pro. Согласие с офертой и процедурой оплаты
   * (legalApi.acceptConsents('subscription')) должно быть записано до этого —
   * иначе бэкенд ответит 403.
   */
  checkout: () => apiClient.post<CheckoutResponse>('/billing/checkout').then((r) => r.data),

  /** Состояние платежа: pending | paid | failed. */
  payment: (id: string) => apiClient.get<PaymentInfo>(`/billing/payments/${id}`).then((r) => r.data),
};
