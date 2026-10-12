import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { kaspiApi } from '../api/kaspi';
import type { Seller } from '../types/api';
import { useAuth } from './AuthContext';

const SELLER_KEY = 'kaspi_analytics_seller_id';

interface SellerContextValue {
  sellers: Seller[];
  currentSeller: Seller | null;
  /**
   * Магазин есть и сессия Kaspi живая. Пока это false, всё приложение кроме
   * «Настроек» закрыто: без подключения аналитике не из чего считаться.
   */
  isConnected: boolean;
  /** Список продавцов уже загружен хотя бы раз — до этого «не подключён» решать рано. */
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  selectSeller: (id: string) => void;
  refresh: () => Promise<void>;
}

const SellerContext = createContext<SellerContextValue | null>(null);

export function SellerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [currentSellerId, setCurrentSellerId] = useState<string | null>(() =>
    localStorage.getItem(SELLER_KEY),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await kaspiApi.listSellers();
      setSellers(list);
      setCurrentSellerId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        if (next) localStorage.setItem(SELLER_KEY, next);
        return next;
      });
    } catch {
      setError('Не удалось загрузить список магазинов');
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else {
      setSellers([]);
      setCurrentSellerId(null);
      setIsReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectSeller = useCallback((id: string) => {
    localStorage.setItem(SELLER_KEY, id);
    setCurrentSellerId(id);
  }, []);

  const currentSeller = useMemo(
    () => sellers.find((s) => s.id === currentSellerId) ?? null,
    [sellers, currentSellerId],
  );

  // needs_reauth — сессия протухла, данные не обновляются: считаем это «не подключён»,
  // чтобы пользователь увидел просьбу войти заново, а не устаревшие цифры.
  const isConnected = !!currentSeller && currentSeller.cookieStatus === 'ok';

  const value = useMemo(
    () => ({ sellers, currentSeller, isConnected, isReady, isLoading, error, selectSeller, refresh }),
    [sellers, currentSeller, isConnected, isReady, isLoading, error, selectSeller, refresh],
  );

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSeller must be used within SellerProvider');
  return ctx;
}
