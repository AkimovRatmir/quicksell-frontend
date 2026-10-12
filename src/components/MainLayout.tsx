import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';
import { Topbar } from './Topbar';
import { UpgradeProvider } from '../context/UpgradeContext';
import { AiInsightsProvider } from '../context/AiInsightsContext';
import { useSeller } from '../context/SellerContext';
import type { TabId } from '../types/nav';
import { DEFAULT_SELECTION, type PeriodSelection } from '../lib/period';
import { DashboardPage } from '../pages/DashboardPage';
import { FinancePage } from '../pages/FinancePage';
import { ProductsPage } from '../pages/ProductsPage';
import { UnitEconomicsPage } from '../pages/UnitEconomicsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TariffPage } from '../pages/TariffPage';
import { AdminPage } from '../pages/AdminPage';
import { useAuth } from '../context/AuthContext';

export function MainLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Сразу после регистрации пользователя приводят в «Настройки» подключать магазин.
  const location = useLocation();
  const initialTab = (location.state as { tab?: TabId } | null)?.tab ?? 'dashboard';
  // Какие шаги подключения магазина пропустили в мастере регистрации
  const setupNeeded = (location.state as { setupNeeded?: { token: boolean; access: boolean } } | null)?.setupNeeded ?? null;

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  // Боковое меню на телефоне: открыто поверх страницы или спрятано.
  const [menuOpen, setMenuOpen] = useState(false);
  const openTab = (tab: TabId) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const [selection, setSelection] = useState<PeriodSelection>(DEFAULT_SELECTION);

  // Пока магазин не подключён (нет продавца, ждём код, сессия протухла),
  // считать нечего — открыты только «Настройки». Решаем после первой загрузки
  // списка продавцов, иначе на мгновение мигнул бы замок у подключённого.
  // Админ-панель от магазина не зависит — её замок не трогает.
  const { isConnected, isReady } = useSeller();
  const locked = isReady && !isConnected;
  useEffect(() => {
    if (locked && activeTab !== 'settings' && activeTab !== 'admin') setActiveTab('settings');
  }, [locked, activeTab]);
  // AI-инсайт генерируется один раз на период и раздаётся во все страницы,
  // поэтому провайдер стоит здесь, над вкладками, а не внутри каждой.
  const aiPeriod = selection.mode === 'period' ? selection.period : '30d';

  return (
    <UpgradeProvider onGoTariff={() => setActiveTab('tariff')}>
    <AiInsightsProvider period={aiPeriod}>
    <div className="app">
      <Sidebar activeTab={activeTab} onChangeTab={openTab} locked={locked} open={menuOpen} />
      {/* Затемнение под выехавшим меню; тап по нему закрывает меню. На десктопе скрыто стилями. */}
      {menuOpen && <div className="sb-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <div className="main-inner">
          <Topbar activeTab={activeTab} selection={selection} onSelectionChange={setSelection} onMenu={() => setMenuOpen(true)} />
          <div className="content">
            {/* key={activeTab}: упавший раздел не тянет за собой меню, а переход
                на другую вкладку даёт ему чистый старт */}
            <ErrorBoundary key={activeTab} variant="section">
            {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} selection={selection} />}
            {activeTab === 'finance' && <FinancePage selection={selection} />}
            {activeTab === 'products' && <ProductsPage selection={selection} />}
            {activeTab === 'unitec' && <UnitEconomicsPage />}
            {activeTab === 'settings' && <SettingsPage setupNeeded={setupNeeded} />}
            {activeTab === 'tariff' && <TariffPage />}
            {activeTab === 'admin' && (isAdmin ? <AdminPage /> : null)}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
    </AiInsightsProvider>
    </UpgradeProvider>
  );
}
