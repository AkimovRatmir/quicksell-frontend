import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Ключи фич — от них зависит только текст в модалке апгрейда. */
export type UpgradeFeature =
  | 'default'
  | 'products'
  | 'growth'
  | 'expenses'
  | 'report'
  | 'unit'
  | 'reco'
  | 'ai'
  | 'orders';

const FEATURES: Record<UpgradeFeature, { title: string; sub: string }> = {
  default: { title: 'Полный доступ', sub: 'Вся аналитика магазина без ограничений.' },
  products: {
    title: 'Прибыль по каждому товару',
    sub: 'Узнайте какие SKU приносят деньги, а какие тихо съедают прибыль.',
  },
  growth: { title: 'Точки роста', sub: 'Где вы недозарабатываете — с суммой в тенге по каждой возможности.' },
  expenses: { title: 'Детальные расходы', sub: 'Увидите куда именно утекают деньги каждый месяц.' },
  report: { title: 'Отчёт за период', sub: 'Любой месяц, свой диапазон дат и сравнение периодов.' },
  unit: { title: 'Безлимитная юнит-экономика', sub: 'Проверяйте прибыльность каждого товара без ограничений.' },
  reco: { title: 'AI-рекомендации', sub: 'Не «что не так», а пошаговый план как это исправить.' },
  ai: { title: 'QuickSell AI', sub: 'Умный разбор бизнеса и что делать — каждый день.' },
  orders: { title: 'Аналитика заказов', sub: 'Скорость сборки, причины отмен и прогноз спроса по заказам.' },
};

interface UpgradeContextValue {
  openUpgrade: (feature?: UpgradeFeature) => void;
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children, onGoTariff }: { children: ReactNode; onGoTariff: () => void }) {
  const [feature, setFeature] = useState<UpgradeFeature | null>(null);

  const openUpgrade = useCallback((next: UpgradeFeature = 'default') => setFeature(next), []);
  const close = useCallback(() => setFeature(null), []);

  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);
  const content = feature ? FEATURES[feature] : null;

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      {content && (
        <div
          className="upgrade-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="um-card">
            <div className="um-icon">
              <LockGlyph size={26} strokeWidth={1.7} />
            </div>
            <div className="um-title">{content.title}</div>
            <div className="um-sub">{content.sub}</div>
            <button
              className="um-btn"
              onClick={() => {
                close();
                onGoTariff();
              }}
            >
              Перейти на Полный доступ
            </button>
            <button className="um-close" onClick={close}>
              Не сейчас
            </button>
          </div>
        </div>
      )}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error('useUpgrade must be used within UpgradeProvider');
  return ctx;
}

export function LockGlyph({ size = 18, strokeWidth = 1.8, color = '#7F77DD' }: { size?: number; strokeWidth?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
