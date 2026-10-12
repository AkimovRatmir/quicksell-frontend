import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { analyticsApi } from '../api/analytics';
import { extractErrorMessage } from '../api/client';
import { useSeller } from '../context/SellerContext';
import { LockGlyph, useUpgrade } from '../context/UpgradeContext';
import { useIsFree } from '../components/Pro';
import type { UnitEconomicsCostItem, UnitEconomicsPayload, UnitEconomicsRecord, UnitEconomicsUsage } from '../types/api';

interface FormState {
  price: string;
  cogs: string;
  comm: string;
  del: string;
  inbound: string;
  pack: string;
  ads: string;
  ret: string;
  other: string;
  vol: string;
  target: string;
}

const initialForm: FormState = {
  price: '',
  cogs: '',
  comm: '15',
  del: '',
  inbound: '',
  pack: '',
  ads: '',
  ret: '3',
  other: '',
  vol: '',
  target: '20',
};

const num = (v: string) => parseFloat(v) || 0;
const fmt = (n: number) => Math.round(n).toLocaleString('ru');

/** Цвет статьи затрат по ключу из ответа бэкенда; незнакомые — из запасной палитры. */
const COST_COLORS: Record<string, string> = {
  cogs: '#7F77DD',
  deliveryToWarehouse: '#AFA9EC',
  inbound: '#AFA9EC',
  commission: '#D85A30',
  kaspiCommission: '#D85A30',
  deliveryToCustomer: '#EF9F27',
  delivery: '#EF9F27',
  packaging: '#1D9E75',
  advertising: '#378ADD',
  ads: '#378ADD',
  returns: '#E24B4A',
  other: '#888780',
  tax: '#5F5E5A',
};
const FALLBACK_COLORS = ['#7F77DD', '#1D9E75', '#EF9F27', '#D85A30', '#378ADD', '#888780', '#A32D2D', '#534AB7'];
const colorFor = (item: UnitEconomicsCostItem, i: number) => COST_COLORS[item.key] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

type Verdict = 'good' | 'warn' | 'bad';

const verdictColors: Record<Verdict, { bg: string; border: string; title: string; sub: string }> = {
  good: { bg: 'var(--teal50)', border: 'var(--teal200)', title: 'var(--teal800)', sub: 'var(--teal600)' },
  warn: { bg: 'var(--amber50)', border: '#FAC775', title: 'var(--amber600)', sub: 'var(--amber600)' },
  bad: { bg: 'var(--coral50)', border: 'var(--coral200)', title: 'var(--coral800)', sub: 'var(--coral600)' },
};

const statusColors: Record<Verdict, { bg: string; text: string }> = {
  good: { bg: '#E1F5EE', text: '#085041' },
  warn: { bg: '#FAEEDA', text: '#854F0B' },
  bad: { bg: '#FAECE7', text: '#712B13' },
};

function verdictOf(marginPct: number, profitPerUnit: number, targetPct: number): Verdict {
  if (profitPerUnit < 0) return 'bad';
  return marginPct < targetPct ? 'warn' : 'good';
}

const verdictLabel: Record<Verdict, string> = { good: 'Прибыльный', warn: 'Ниже цели', bad: 'Убыток' };

/** Лимит бесплатных расчётов по умолчанию — пока бэкенд не прислал свой. */
const FREE_LIMIT_DEFAULT = 10;

/**
 * Сколько записей истории тянем. Больше лимита — по ним считаем, сколько
 * расчётов уже сделано в этом месяце, когда бэкенд не прислал usage.
 */
const HISTORY_FETCH_LIMIT = 20;

function isCurrentMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Названия расчётов в истории. Бэкенд поле не хранит, поэтому держим их в
 * localStorage по id записи — переживают перезагрузку, но живут в этом браузере.
 */
const NAMES_KEY = 'qs_unit_calc_names';

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveNames(names: Record<string, string>) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function toPayload(form: FormState): UnitEconomicsPayload {
  return {
    salePrice: num(form.price),
    costPrice: num(form.cogs),
    kaspiCommissionPct: num(form.comm),
    deliveryToCustomer: num(form.del),
    deliveryToWarehouse: num(form.inbound),
    packaging: num(form.pack),
    advertisingPerUnit: num(form.ads),
    returnsPct: num(form.ret),
    otherExpenses: num(form.other),
    salesPerMonth: num(form.vol),
    targetMarginPct: num(form.target),
  };
}

export function UnitEconomicsPage() {
  const { currentSeller } = useSeller();
  const { openUpgrade } = useUpgrade();
  const isFree = useIsFree();

  const [form, setForm] = useState(initialForm);
  const [record, setRecord] = useState<UnitEconomicsRecord | null>(null);
  const [history, setHistory] = useState<UnitEconomicsRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [usage, setUsage] = useState<UnitEconomicsUsage | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>(loadNames);

  const setName = (id: string, value: string) =>
    setNames((prev) => {
      const next = { ...prev, [id]: value };
      if (!value.trim()) delete next[id];
      saveNames(next);
      return next;
    });

  const loadHistory = useCallback(() => {
    if (!currentSeller) {
      setHistory([]);
      return;
    }
    analyticsApi
      .listUnitEconomics(currentSeller.id, HISTORY_FETCH_LIMIT)
      .then((res) => {
        setHistory(res.data);
        if (res.usage) setUsage(res.usage);
      })
      .catch(() => setHistory([]));
  }, [currentSeller]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Счётчик лимита. Источник — usage от бэкенда; если его нет, считаем сами
  // по истории: каждый расчёт в ней сохраняется, так что число записей за
  // текущий месяц и есть «использовано». Так остаток переживает перезагрузку.
  const monthUsed = useMemo(() => history.filter((h) => h.createdAt && isCurrentMonth(h.createdAt)).length, [history]);
  const limit = usage?.limit ?? FREE_LIMIT_DEFAULT;
  const used = usage?.used ?? monthUsed;
  // На Pro лимита нет — remaining = null.
  const remaining = isFree ? Math.max(0, limit - used) : null;
  const limitReached = remaining != null && remaining <= 0;

  // Считает и сразу сохраняет расчёт на бэкенде — он же следит за лимитом тарифа.
  const handleCalculate = async () => {
    if (!currentSeller) return;
    const payload = toPayload(form);
    if (!payload.salePrice) {
      setError('Укажите цену продажи');
      return;
    }
    setIsCalculating(true);
    setError(null);
    try {
      const saved = await analyticsApi.saveUnitEconomics(currentSeller.id, payload);
      setRecord(saved);
      // Остаток пересчитываем сразу после каждого расчёта: берём цифру бэкенда,
      // а если он её не прислал — списываем одну попытку сами, чтобы счётчик
      // не застывал до следующей загрузки истории.
      if (saved.usage) setUsage(saved.usage);
      else if (isFree) {
        const nextUsed = used + 1;
        setUsage({ plan: 'free', limit, used: nextUsed, remaining: Math.max(0, limit - nextUsed) });
      }
      loadHistory();
    } catch (err) {
      // Бэкенд отбил по квоте — фиксируем остаток 0, чтобы кнопка погасла,
      // а не давала жать снова и ловить ту же ошибку.
      const body = axios.isAxiosError(err) ? (err.response?.data as { code?: string; limit?: number; used?: number } | undefined) : undefined;
      if (body?.code === 'FREE_LIMIT_REACHED') {
        setUsage((prev) => ({
          plan: prev?.plan ?? 'free',
          limit: body.limit ?? prev?.limit ?? FREE_LIMIT_DEFAULT,
          used: body.used ?? prev?.used ?? FREE_LIMIT_DEFAULT,
          remaining: 0,
        }));
      }
      setError(extractErrorMessage(err, 'Не удалось выполнить расчёт'));
    } finally {
      setIsCalculating(false);
    }
  };

  if (!currentSeller) {
    return (
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: '#888' }}>
        Сначала подключите магазин Kaspi во вкладке «Настройки».
      </div>
    );
  }

  const result = record?.result ?? null;
  const target = num(form.target);
  const verdict: Verdict | null = result ? verdictOf(result.marginPct, result.profitPerUnit, target) : null;
  const vc = verdict ? verdictColors[verdict] : null;
  const costStructure = record?.costStructure ?? [];

  return (
    <div>
      {/* Лимит бесплатного тарифа — плашка из прототипа: одна строка и кнопка.
          Пока попытки есть — счётчик, кончились — призыв перейти на Pro. */}
      {isFree &&
        remaining != null &&
        (limitReached ? (
          <div className="ue-limit">
            <div className="ue-icon">
              <LockGlyph size={18} />
            </div>
            <div className="ue-txt">
              <div className="ue-t1">Бесплатные расчёты в этом месяце закончились - переходите на PRO и считайте без ограничений!</div>
            </div>
            <button className="upsell-btn" onClick={() => openUpgrade('unit')}>
              Перейти на Pro
            </button>
          </div>
        ) : (
          <div className="ue-limit">
            <div className="ue-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div className="ue-txt">
              <div className="ue-t1">
                {remaining === 1 ? 'Остался' : 'Осталось'} {remaining} из {limit} бесплатных {plural(remaining, 'расчёт', 'расчёта', 'расчётов')} в этом
                месяце
              </div>
            </div>
            <button className="upsell-btn" onClick={() => openUpgrade('unit')}>
              Убрать лимит
            </button>
          </div>
        ))}

      {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
        <div className="kpi purple">
          <div className="kpi-label" style={{ fontSize: 12 }}>Прибыль с товара</div>
          <div className="kpi-val" style={{ fontSize: 24, marginTop: 4 }}>{result ? `${fmt(result.profitPerUnit)} ₸` : '—'}</div>
          <div className="kpi-delta" style={{ fontSize: 11, color: 'var(--purple600)' }}>на единицу</div>
        </div>
        <div className="kpi teal">
          <div className="kpi-label" style={{ fontSize: 12 }}>Маржа</div>
          <div className="kpi-val" style={{ fontSize: 24, marginTop: 4 }}>{result ? `${result.marginPct.toFixed(1)}%` : '—'}</div>
          <div className="kpi-delta" style={{ fontSize: 11, color: 'var(--teal600)' }}>от цены продажи</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label" style={{ fontSize: 12 }}>Окупаемость</div>
          <div className="kpi-val" style={{ fontSize: 24, marginTop: 4 }}>{result?.roiPct != null ? `${result.roiPct.toFixed(1)}%` : '—'}</div>
          <div className="kpi-delta" style={{ fontSize: 11, color: 'var(--blue600)' }}>возврат на вложения</div>
        </div>
        <div className="kpi gray">
          <div className="kpi-label" style={{ fontSize: 12 }}>Прибыль в месяц</div>
          <div className="kpi-val" style={{ fontSize: 24, marginTop: 4 }}>{result ? `${fmt(result.monthlyProfit)} ₸` : '—'}</div>
          <div className="kpi-delta" style={{ fontSize: 11, color: '#5F5E5A' }}>при заданном объёме</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 14 }}>
            Параметры товара
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Цена продажи (₸)" value={form.price} onChange={setField('price')} placeholder="5000" />
            <Field label="Себестоимость (₸)" value={form.cogs} onChange={setField('cogs')} placeholder="2000" />
            <Field label="Комиссия Kaspi (%)" value={form.comm} onChange={setField('comm')} step="0.5" />
            <Field label="Доставка покупателю (₸)" value={form.del} onChange={setField('del')} placeholder="600" />
            <Field label="Доставка до склада (₸)" value={form.inbound} onChange={setField('inbound')} placeholder="200" />
            <Field label="Упаковка (₸)" value={form.pack} onChange={setField('pack')} placeholder="150" />
            <Field label="Реклама на ед. (₸)" value={form.ads} onChange={setField('ads')} placeholder="300" />
            <Field label="% возвратов" value={form.ret} onChange={setField('ret')} step="0.5" />
            <Field label="Прочие расходы (₸)" value={form.other} onChange={setField('other')} placeholder="100" />
            <Field label="Продаж в месяц (шт)" value={form.vol} onChange={setField('vol')} placeholder="100" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12 }}>Целевая маржа (%)</label>
            <input type="number" value={form.target} onChange={setField('target')} style={{ fontSize: 13, padding: '8px 10px' }} />
          </div>
          {/* Себестоимость можно задать долей цены — тот же принцип, что в настройках */}
          {num(form.price) > 0 && num(form.cogs) > 0 && (
            <div style={{ fontSize: 11.5, color: '#888', marginBottom: 10 }}>
              Себестоимость = <b style={{ color: '#534AB7' }}>{((num(form.cogs) / num(form.price)) * 100).toFixed(0)}%</b> от цены продажи
            </div>
          )}
          {limitReached ? (
            // Попытки кончились — вместо неактивной кнопки сразу ведём на Pro
            <button className="ue-cta" onClick={() => openUpgrade('unit')}>
              <LockGlyph size={15} color="#fff" />
              Перейти на Pro
            </button>
          ) : (
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: 'none',
                background: '#1F1F1F',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: isCalculating ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isCalculating ? 'Считаем…' : 'Рассчитать'}
            </button>
          )}
          {/* Остаток прямо под кнопкой — обновляется после каждого расчёта */}
          {remaining != null && !limitReached && (
            <div className="ue-left">
              {remaining === 1 ? 'Остался' : 'Осталось'} <b>{remaining}</b> из {limit} бесплатных {plural(remaining, 'расчёт', 'расчёта', 'расчётов')}
              {remaining <= 3 && (
                <>
                  {' · '}
                  <b style={{ cursor: 'pointer' }} onClick={() => openUpgrade('unit')}>
                    убрать лимит
                  </b>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 12 }}>
              Структура затрат
            </div>
            {!result ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center', gap: 8 }}>
                <div style={{ fontSize: 28, opacity: 0.2 }}>📊</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#aaa' }}>Заполните параметры и нажмите «Рассчитать»</div>
                <div style={{ fontSize: 12, color: '#ccc' }}>Здесь появится разбивка всех затрат по статьям</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {costStructure.map((item, i) => {
                  const color = colorFor(item, i);
                  const isLast = i === costStructure.length - 1;
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 0',
                        borderBottom: isLast ? undefined : '0.5px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#444', flex: 1 }}>{item.label}</span>
                      <div style={{ width: 110, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: `${Math.min(100, item.share)}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#aaa', width: 36, textAlign: 'right' }}>{item.share.toFixed(1)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#993C1D', width: 82, textAlign: 'right' }}>−{fmt(item.amount)} ₸</span>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 'auto', fontSize: 13.5, fontWeight: 500 }}>
                  <span>Итого затраты</span>
                  <span style={{ color: '#993C1D' }}>−{fmt(result.totalCostPerUnit)} ₸</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, fontWeight: 500 }}>
                  <span>Прибыль</span>
                  <span style={{ color: result.profitPerUnit >= 0 ? '#0F6E56' : '#993C1D' }}>
                    {result.profitPerUnit >= 0 ? '+' : ''}
                    {fmt(result.profitPerUnit)} ₸
                  </span>
                </div>
              </div>
            )}
          </div>
          {result && verdict && vc && (
            <div className={`verdict ${verdict}`}>
              <div className="v-title" style={{ fontSize: 13 }}>
                {verdict === 'bad' ? 'Товар убыточен' : verdict === 'warn' ? 'Маржа ниже цели' : 'Товар прибыльный'}
              </div>
              <div className="v-sub" style={{ fontSize: 12, marginTop: 4 }}>
                {verdict === 'good'
                  ? `Маржа ${result.marginPct.toFixed(1)}% превышает цель ${target}%. Прибыль ${fmt(result.monthlyProfit)} ₸/мес при заданном объёме.`
                  : result.recommendedPrice != null
                    ? `Маржа ${result.marginPct.toFixed(1)}% vs цель ${target}%. Рекомендуемая цена: ${fmt(result.recommendedPrice)} ₸`
                    : `Маржа ${result.marginPct.toFixed(1)}% vs цель ${target}%. При таких расходах цель недостижима ни при какой цене — снизьте расходы или цель.`}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: '#7F77DD', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}
        >
          <span style={{ fontSize: 11, transition: 'transform 0.2s', display: 'inline-block', transform: historyOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
          Посмотреть историю расчётов
          {history.length > 0 && (
            <span style={{ fontSize: 11, background: '#EEEDFE', color: '#534AB7', padding: '1px 7px', borderRadius: 4 }}>{history.length}</span>
          )}
        </button>
      </div>

      {historyOpen && (
        <div style={{ marginTop: 8 }}>
          {history.length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb', padding: '12px 0' }}>
              Пока нет сохранённых расчётов. Нажмите «Рассчитать» — расчёт сохранится автоматически.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {history.map((h) => {
                const targetPct = h.inputs?.targetMarginPct ?? 0;
                const status = verdictOf(h.result.marginPct, h.result.profitPerUnit, targetPct);
                const sc = statusColors[status];
                return (
                  <div key={h.id} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                      {/* Название вписывает сам пользователь — как в прототипе; дата остаётся мелкой подписью */}
                      <input
                        type="text"
                        className="ue-name"
                        value={names[h.id] ?? ''}
                        placeholder="Название товара…"
                        onChange={(e) => setName(h.id, e.target.value)}
                      />
                      {h.createdAt && (
                        <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{new Date(h.createdAt).toLocaleDateString('ru')}</span>
                      )}
                      <span style={{ fontSize: 11, background: sc.bg, color: sc.text, padding: '3px 9px', borderRadius: 5, flexShrink: 0 }}>
                        {verdictLabel[status]}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <MiniStat
                        label="Цена / себестоимость"
                        value={
                          h.inputs?.salePrice != null
                            ? `${fmt(h.inputs.salePrice)} / ${fmt(h.inputs.costPrice ?? 0)} ₸`
                            : '—'
                        }
                      />
                      <MiniStat
                        label="Прибыль с ед."
                        value={`${h.result.profitPerUnit >= 0 ? '+' : ''}${fmt(h.result.profitPerUnit)} ₸`}
                        color={h.result.profitPerUnit >= 0 ? '#0F6E56' : '#993C1D'}
                      />
                      <MiniStat label="Маржа" value={`${h.result.marginPct.toFixed(1)}%`} color="#534AB7" />
                      <MiniStat label="Прибыль/мес" value={`${fmt(h.result.monthlyProfit)} ₸`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="field">
      <label style={{ fontSize: 12 }}>{label}</label>
      <input type="number" value={value} onChange={onChange} placeholder={placeholder} step={step} style={{ fontSize: 13, padding: '8px 10px' }} />
    </div>
  );
}

function MiniStat({ label, value, color = '#1a1a1a' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color }}>{value}</div>
    </div>
  );
}
