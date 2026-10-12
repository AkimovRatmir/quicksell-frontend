import { apiClient, SKIP_AUTH_REDIRECT_HEADER } from './client';
import type { AcceptedDocument, LegalDocument } from '../types/api';

/**
 * Повод согласия. Набор документов под каждый повод определяет бэкенд:
 * registration — оферта и политика, subscription — оферта и процедура оплаты.
 */
export type ConsentContext = 'registration' | 'subscription';

export const legalApi = {
  /**
   * Актуальные версии документов — их отправляем в acceptedDocuments при
   * регистрации. Ответ принимаем и списком, и обёрткой.
   */
  listDocuments: () =>
    apiClient
      .get<LegalDocument[] | { documents?: LegalDocument[] }>('/legal/documents', {
        headers: { [SKIP_AUTH_REDIRECT_HEADER]: '1' },
      })
      .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.documents ?? []))),

  /**
   * Фиксирует согласие. Вызывается в момент подтверждения подписки, а не при
   * переключении чекбокса: запись означает «пользователь подтвердил», и
   * поставить её на снятую потом галочку нельзя. accepted принимается только true.
   */
  acceptConsents: (context: ConsentContext) =>
    apiClient
      .post<{ accepted: AcceptedDocument[] }>('/legal/consents', { context, accepted: true })
      .then((r) => r.data),
};
