import { useEffect, useRef, useState } from 'react';
import { LogoMark, IconHome, IconFinance, IconProducts, IconUnitEconomics, IconSettings, IconTariff, IconLogout } from './Icons';
import type { TabId } from '../types/nav';
import { useAuth } from '../context/AuthContext';
import { useSeller } from '../context/SellerContext';
import { LockGlyph } from '../context/UpgradeContext';

interface SidebarItemDef {
  id: TabId;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEMS: SidebarItemDef[] = [
  { id: 'dashboard', label: 'Главная', icon: <IconHome /> },
  { id: 'finance', label: 'Прибыль и расходы', icon: <IconFinance /> },
  { id: 'products', label: 'Товарная статистика', icon: <IconProducts /> },
  { id: 'unitec', label: 'Юнит-экономика', icon: <IconUnitEconomics /> },
];

interface SidebarProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  /** Магазин ещё не подключён — всё, кроме «Настроек», под замком. */
  locked?: boolean;
  /**
   * На телефоне панель выезжает поверх страницы (см. @media в global.css).
   * На десктопе флаг ни на что не влияет — панель там видна всегда.
   */
  open?: boolean;
}

export function Sidebar({ activeTab, onChangeTab, locked = false, open = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const { currentSeller } = useSeller();

  // Момент разблокировки: замки только что сняли — разделы коротко «зажигаются»,
  // чтобы было видно, что теперь они открыты. Один раз, на полторы секунды.
  const wasLocked = useRef(locked);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (wasLocked.current && !locked) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 1500);
      wasLocked.current = locked;
      return () => clearTimeout(t);
    }
    wasLocked.current = locked;
  }, [locked]);
  const unlockClass = justUnlocked ? ' unlocked' : '';

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`sidebar${open ? ' open' : ''}`}>
      <div className="sb-logo" style={{ padding: '20px 16px 12px' }}>
        <LogoMark size={14} />
      </div>

      <div className="sb-section">Аналитика</div>
      {NAV_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`sb-item${activeTab === item.id ? ' active' : ''}${locked ? ' locked' : ''}${unlockClass}`}
          title={locked ? 'Откроется после подключения магазина Kaspi' : undefined}
          // Клик по закрытому разделу ведёт туда, где его можно открыть
          onClick={() => onChangeTab(locked ? 'settings' : item.id)}
        >
          {item.icon}
          {item.label}
          {locked && <LockGlyph size={12} strokeWidth={2} color="currentColor" />}
        </div>
      ))}

      <div className="sb-divider" />
      <div className="sb-section">Система</div>
      <div
        className={`sb-item${activeTab === 'settings' ? ' active' : ''}`}
        onClick={() => onChangeTab('settings')}
      >
        <IconSettings />
        Настройки
      </div>
      <div
        className={`sb-item${activeTab === 'tariff' ? ' active' : ''}${locked ? ' locked' : ''}${unlockClass}`}
        title={locked ? 'Откроется после подключения магазина Kaspi' : undefined}
        onClick={() => onChangeTab(locked ? 'settings' : 'tariff')}
      >
        <IconTariff />
        Тариф
        {locked && <LockGlyph size={12} strokeWidth={2} color="currentColor" />}
      </div>

      {user?.role === 'admin' && (
        <>
          <div className="sb-divider" />
          <div className="sb-section">Администрирование</div>
          <div
            className={`sb-item${activeTab === 'admin' ? ' active' : ''}`}
            onClick={() => onChangeTab('admin')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Админ-панель
          </div>
        </>
      )}

      <div className="sb-bottom">
        <div className="sb-store">
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-name">{user?.name ?? 'Пользователь'}</div>
            <div className="sb-plan">{currentSeller?.name ?? (locked ? 'Магазин не подключён' : 'Нет магазина')}</div>
          </div>
          <div className="online-dot" />
        </div>
        <a href="#" className="sb-logout" onClick={(e) => { e.preventDefault(); logout(); }}>
          <IconLogout />
          Выйти
        </a>
      </div>
    </div>
  );
}
