import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import { useSeller } from './SellerContext';
import { useIsFree } from '../components/Pro';
import type { AiInsights, AiInsightsResponse } from '../types/api';

interface AiInsightsState {
  insights: AiInsights | null;
  generatedAt: string | null;
  isLoading: boolean;
  /** Сообщение об ошибке для показа в блоке. null — всё в порядке. */
  error: string | null;
  /** 503 — на бэкенде не настроен ключ OpenAI. Это не сбой у пользователя. */
  disabled: boolean;
  /** Перегенерировать вручную. */
  refresh: () => void;
}

const AiInsightsCtx = createContext<AiInsightsState>({
  insights: null,
  generatedAt: null,
  isLoading: false,
  error: null,
  disabled: false,
  refresh: () => {},
});

export const useAiInsights = () => useContext(AiInsightsCtx);

/**
 * Один AI-инсайт на все страницы.
 *
 * Эндпоинт `POST /ai-insights` ходит в OpenAI: он платный и медленный, а его
 * ответ содержит разделы сразу для «Главной», «Прибыли и расходов» и
 * «Товарной статистики». Поэтому запрос живёт здесь, а не в страницах —
 * иначе переключение вкладок генерировало бы инсайт заново на каждой.
 */
export function AiInsightsProvider({ period, children }: { period: string; children: React.ReactNode }) {
  const { currentSeller } = useSeller();
  const isFree = useIsFree();
  const [data, setData] = useState<AiInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  // Счётчик ручных обновлений: меняется — эффект перезапускается.
  const [reloadToken, setReloadToken] = useState(0);
  // Что уже сгенерировано: защищает от повторного платного вызова
  // при перемонтировании дерева.
  const doneKey = useRef<string | null>(null);

  const sellerId = currentSeller?.id ?? null;

  useEffect(() => {
    if (!sellerId) {
      setData(null);
      doneKey.current = null;
      return;
    }
    // На бесплатном тарифе AI-блоки закрыты замком. Генерировать инсайт для
    // них — платить за текст, который пользователь не должен увидеть; к тому
    // же под размытием он лежал бы в DOM в открытом виде.
    if (isFree) {
      setData(null);
      doneKey.current = null;
      return;
    }
    const key = `${sellerId}:${period}:${reloadToken}`;
    if (doneKey.current === key) return;
    doneKey.current = key;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDisabled(false);
    // reloadToken>0 means the user pressed «Обновить» → force a fresh
    // generation past the 24h server cache; first load uses the cache.
    analyticsApi
      .generateAiInsights(sellerId, period, reloadToken > 0)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        // Повторный автозапрос после ошибки не делаем — вызов платный.
        // Пользователь при желании нажмёт «Обновить».
        if (axios.isAxiosError(err) && err.response?.status === 503) setDisabled(true);
        else setError(extractErrorMessage(err, 'Не удалось получить AI-инсайт'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, period, isFree, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return (
    <AiInsightsCtx.Provider
      value={{
        insights: data?.insights ?? null,
        generatedAt: data?.generatedAt ?? null,
        isLoading,
        error,
        disabled,
        refresh,
      }}
    >
      {children}
    </AiInsightsCtx.Provider>
  );
}

/**
 * Текст-заглушка, пока инсайта нет. Возвращает null, если показывать нечего —
 * тогда страница рисует свою сводку по цифрам.
 */
export function aiPlaceholder(state: Pick<AiInsightsState, 'isLoading' | 'error' | 'disabled'>): string | null {
  if (state.isLoading) return 'QuickSell AI разбирает цифры…';
  // Причина (нет ключа OpenAI на сервере) — наша, а не пользователя; ему
  // достаточно знать, что это временно и чинить у себя ничего не надо.
  if (state.disabled) return 'AI-анализ временно недоступен. Остальная аналитика работает как обычно.';
  if (state.error) return state.error;
  return null;
}
