import { useEffect, useRef, useState } from 'react';
import type { TabId } from '../types/nav';
import { TAB_TITLES, TABS_WITHOUT_PERIOD_CONTROLS } from '../types/nav';
import { IconBell, IconMenu } from './Icons';
import { useSeller } from '../context/SellerContext';
import type { AnalyticsPeriod } from '../types/api';
import { currentMonthKey, daysInMonth, formatMonthTitle, recentMonths, type PeriodSelection } from '../lib/period';
import { useIsFree } from './Pro';
import { useUpgrade } from '../context/UpgradeContext';

const PERIOD_OPTIONS: { key: AnalyticsPeriod; label: string }[] = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: '90d', label: '90 дней' },
  { key: '12m', label: '12 мес' },
];

// Список месяцев для отчёта строится от сегодняшней даты, а не хардкодом.
const REPORT_MONTHS = recentMonths(12);

interface TopbarProps {
  activeTab: TabId;
  selection: PeriodSelection;
  onSelectionChange: (selection: PeriodSelection) => void;
  /** Открыть боковое меню — кнопка показывается только на узких экранах. */
  onMenu?: () => void;
}

export function Topbar({ activeTab, selection, onSelectionChange, onMenu }: TopbarProps) {
  const { currentSeller } = useSeller();
  const isFree = useIsFree();
  const { openUpgrade } = useUpgrade();
  const [notifOpen, setNotifOpen] = useState(false);
  // Запоминаем последний выбор в режиме «Отчёт», чтобы переключение
  // Период ⇄ Отчёт не сбрасывало месяц и диапазон.
  const [lastReport, setLastReport] = useState<{ month: string; range: 'full' | 'mtd' }>({
    month: currentMonthKey(),
    range: 'full',
  });
  const [lastPeriod, setLastPeriod] = useState<AnalyticsPeriod>('30d');
  const notifRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef(selection.mode);

  const showControls = !TABS_WITHOUT_PERIOD_CONTROLS.has(activeTab);
  const mode = selection.mode;
  const reportMonth = selection.mode === 'report' ? selection.month : lastReport.month;
  const reportRange = selection.mode === 'report' ? selection.range : lastReport.range;
  const isMtd = reportRange === 'mtd';

  useEffect(() => {
    if (selection.mode === 'period') setLastPeriod(selection.period);
    else setLastReport({ month: selection.month, range: selection.range });
  }, [selection]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [notifOpen]);

  // Smooth cross-fade/slide swap between the period and report control groups,
  // mirroring the prototype's _fadeSwap: fade+slide the old group out, then
  // fade+slide the new one in from the other side.
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    const hideEl = prevModeRef.current === 'period' ? periodRef.current : reportRef.current;
    const showEl = mode === 'period' ? periodRef.current : reportRef.current;
    prevModeRef.current = mode;
    if (!hideEl || !showEl || hideEl === showEl) return;

    hideEl.classList.add('out');
    const timer = setTimeout(() => {
      hideEl.style.display = 'none';
      hideEl.classList.remove('out');
      showEl.style.display = 'flex';
      showEl.classList.add('in-left');
      requestAnimationFrame(() => requestAnimationFrame(() => showEl.classList.remove('in-left')));
    }, 220);
    return () => clearTimeout(timer);
  }, [mode]);

  // Контролы размонтируются на вкладках без периода (настройки, тариф, юнит-экономика).
  // При возврате DOM создаётся заново со стартовым display — приводим его к
  // актуальному режиму, иначе после «Отчёт → Настройки → Главная» видна не та группа.
  useEffect(() => {
    if (!showControls) return;
    const per = periodRef.current;
    const rep = reportRef.current;
    if (!per || !rep) return;
    per.style.display = mode === 'period' ? 'flex' : 'none';
    rep.style.display = mode === 'report' ? 'flex' : 'none';
    prevModeRef.current = mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls]);

  const segStyle = (active: boolean) => ({
    padding: '4px 12px',
    fontSize: 11.5,
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? '#1F1F1F' : 'transparent',
    color: active ? '#fff' : '#888',
    fontWeight: active ? 500 : 400,
  });

  const rangeStyle = (active: boolean) => ({
    padding: '3px 10px',
    fontSize: 11,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? '#1F1F1F' : 'transparent',
    color: active ? '#fff' : '#888',
  });

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button type="button" className="tb-menu" onClick={onMenu} aria-label="Открыть меню">
          <IconMenu />
        </button>
        <div className="topbar-title">{TAB_TITLES[activeTab]}</div>
        <div
          style={{
            fontSize: 11,
            padding: '3px 8px',
            background: 'var(--teal50)',
            borderRadius: 5,
            color: 'var(--teal600)',
          }}
        >
          {currentSeller?.name ?? 'Нет магазина'}
        </div>
      </div>
      <div className="topbar-right">
        {showControls && (
          <div id="topbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 7, padding: 2, gap: 1 }}>
              <button
                className="seg-btn"
                onClick={() => onSelectionChange({ mode: 'period', period: lastPeriod })}
                style={segStyle(mode === 'period')}
              >
                Период
              </button>
              <button
                className="seg-btn"
                onClick={() =>
                  isFree
                    ? openUpgrade('report')
                    : onSelectionChange({ mode: 'report', month: lastReport.month, range: lastReport.range })
                }
                style={{ ...segStyle(mode === 'report'), display: 'flex', alignItems: 'center', gap: 5 }}
              >
                Отчёт
                {isFree && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      background: 'linear-gradient(135deg,#7F77DD,#9F99EE)',
                      color: '#fff',
                      padding: '1px 4px',
                      borderRadius: 3,
                      letterSpacing: '0.02em',
                    }}
                  >
                    PRO
                  </span>
                )}
              </button>
            </div>

            {/* display переключает эффект ниже — так успевает проиграть плавная смена групп */}
            <div ref={periodRef} className="tb-swap" style={{ display: 'flex', gap: 4, marginLeft: 14 }}>
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  className={`btn-period${selection.mode === 'period' && selection.period === p.key ? ' active' : ''}`}
                  onClick={() => onSelectionChange({ mode: 'period', period: p.key })}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div ref={reportRef} className="tb-swap" style={{ display: 'none', alignItems: 'center', gap: 6, marginLeft: 14 }}>
              {/* В режиме «Сейчас» месяц всегда текущий — выбор месяца выключаем */}
              <select
                value={isMtd ? currentMonthKey() : reportMonth}
                disabled={isMtd}
                onChange={(e) => onSelectionChange({ mode: 'report', month: e.target.value, range: 'full' })}
                style={{
                  padding: '4px 10px',
                  fontSize: 11.5,
                  border: '0.5px solid rgba(0,0,0,0.12)',
                  borderRadius: 6,
                  background: isMtd ? '#f4f4f6' : '#fff',
                  color: isMtd ? '#aaa' : '#333',
                  fontFamily: 'inherit',
                  cursor: isMtd ? 'default' : 'pointer',
                  outline: 'none',
                }}
              >
                {REPORT_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthTitle(m)}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 6, padding: 2, gap: 1 }}>
                <button
                  className="seg-btn"
                  onClick={() => onSelectionChange({ mode: 'report', month: reportMonth, range: 'full' })}
                  style={rangeStyle(!isMtd)}
                  title="Выбранный месяц целиком"
                >
                  1–{daysInMonth(isMtd ? currentMonthKey() : reportMonth)}
                </button>
                <button
                  className="seg-btn"
                  onClick={() => onSelectionChange({ mode: 'report', month: currentMonthKey(), range: 'mtd' })}
                  style={rangeStyle(isMtd)}
                  title="Текущий месяц с 1-го числа по сегодня"
                >
                  1 → сегодня
                </button>
              </div>
            </div>
            <div style={{ width: 0.5, height: 18, background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />
          </div>
        )}
        <div className="notif-wrap" ref={notifRef}>
          <button
            className={`notif-btn${notifOpen ? ' on' : ''}`}
            title="Уведомления"
            onClick={(e) => {
              e.stopPropagation();
              setNotifOpen((v) => !v);
            }}
          >
            <IconBell />
          </button>
          <div className={`notif-pop${notifOpen ? ' open' : ''}`}>
            <div className="notif-pop-head">Уведомления</div>
            <div className="notif-pop-body">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.6a6.4 6.4 0 0 1 6.4 6.4v4l1.7 2.6H3.9L5.6 13V9A6.4 6.4 0 0 1 12 2.6z" />
                <path d="M9.6 19a2.4 2.4 0 0 0 4.8 0" />
              </svg>
              <div className="notif-empty">Пока нет уведомлений</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
