export type TabId = 'dashboard' | 'finance' | 'products' | 'unitec' | 'settings' | 'tariff' | 'admin';

export const TAB_TITLES: Record<TabId, string> = {
  dashboard: 'Главная',
  finance: 'Прибыль и расходы',
  products: 'Товарная статистика',
  unitec: 'Юнит-экономика',
  settings: 'Настройки',
  tariff: 'Тариф',
  admin: 'Админ-панель',
};

export const TABS_WITHOUT_PERIOD_CONTROLS = new Set<TabId>(['unitec', 'settings', 'tariff', 'admin']);
