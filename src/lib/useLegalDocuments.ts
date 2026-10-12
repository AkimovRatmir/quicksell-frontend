import { useCallback, useEffect, useState } from 'react';
import { legalApi } from '../api/legal';
import type { AcceptedDocument, LegalDocCode, LegalDocument } from '../types/api';

/**
 * Актуальные версии юридических документов. Согласие фиксируется вместе с
 * версией: через полгода нужно знать, под какой редакцией оферты подписался
 * пользователь.
 *
 * Список может не приехать (эндпоинт ещё не готов, сеть). Это не должно
 * ломать регистрацию и оплату, поэтому версии — необязательная добавка:
 * без них отправляем только коды, версию проставит бэкенд.
 */
export function useLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);

  useEffect(() => {
    let cancelled = false;
    legalApi
      .listDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /** Версии для набора кодов — в формате, который ждут /auth/register и /legal/consents. */
  const acceptedFor = useCallback(
    (codes: LegalDocCode[]): AcceptedDocument[] | undefined => {
      const picked = codes
        .map((code) => documents.find((d) => d.code === code))
        .filter((d): d is LegalDocument => Boolean(d?.version))
        .map((d) => ({ code: d.code, version: d.version }));
      return picked.length === codes.length ? picked : undefined;
    },
    [documents],
  );

  return { documents, acceptedFor };
}
