import { useEffect, useState } from 'react';
import { kaspiApi } from '../api/kaspi';
import type { KaspiActiveOrder, KaspiOrder } from '../types/api';

/**
 * Для сводки хватает четырёх полей, и они есть и у архивного заказа, и у
 * активного — остальное у них не совпадает.
 */
type CountedOrder = Pick<KaspiOrder, 'code' | 'status' | 'totalPrice' | 'creationDate'>;

/** Окно выгрузки заказов: текущая неделя + история для среднего чека. */
const WEEKS = 8;
const PAGE_SIZE = 200;
const MAX_PAGES = 5;

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export interface WeekDay {
  /** Локальный ключ даты "YYYY-MM-DD" */
  key: string;
  /** «Пн» */
  label: string;
  /** «11 авг» */
  dateLabel: string;
  /** «11 августа» — для подсказки при наведении */
  fullDateLabel: string;
  count: number;
  /** День ещё не наступил — заказов не может быть в принципе, это не ноль продаж. */
  isFuture: boolean;
  isToday: boolean;
}

export interface OrdersDigest {
  todayRevenue: number;
  todayOrders: number;
  /** Средний чек за сегодня; если заказов сегодня нет — за всё окно. */
  avgCheck: number;
  avgCheckIsWindow: boolean;
  /** Дни текущей недели, Пн…Вс, с реальными датами. */
  week: WeekDay[];
  windowOrders: number;
  weeks: number;
  /** Дата самого свежего заказа — по ней видно, актуальна ли выгрузка. */
  lastOrderAt: string | null;
  /** Сколько сегодняшних заказов ещё не доехали до архива — суммы по ним не финальные. */
  todayActiveOrders: number;
}

const isVoided = (status: string) => /CANCEL|RETURN/i.test(status);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ключ календарного дня по ЛОКАЛЬНОМУ времени. Через toISOString() в UTC+5
 * заказы, созданные до 05:00, уезжали бы на предыдущий день.
 */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Понедельник текущей недели, локальная полночь. */
function startOfWeek(now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function buildWeek(counts: Map<string, number>, now: Date): WeekDay[] {
  const monday = startOfWeek(now);
  const todayKey = localDayKey(now);
  return WEEKDAY_LABELS.map((label, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = localDayKey(date);
    return {
      key,
      label,
      dateLabel: `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`,
      fullDateLabel: `${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}`,
      count: counts.get(key) ?? 0,
      isFuture: key > todayKey,
      isToday: key === todayKey,
    };
  });
}

/**
 * Архивные и активные заказы приходят из разных источников и пересекаются:
 * заказ, только что доехавший до архива, есть в обоих списках. Ключ — `code`.
 */
function mergeOrders(archived: KaspiOrder[], active: KaspiActiveOrder[]): CountedOrder[] {
  const byCode = new Map<string, CountedOrder>();
  for (const order of archived) byCode.set(order.code, order);
  // Активный список живой, но архивная запись финальная — она и побеждает.
  for (const order of active) if (!byCode.has(order.code)) byCode.set(order.code, order);
  return [...byCode.values()];
}

function aggregate(orders: CountedOrder[], now: Date, activeCodes: Set<string>): OrdersDigest {
  const perDay = new Map<string, number>();
  let todayRevenue = 0;
  let todayOrders = 0;
  let windowRevenue = 0;
  let windowOrders = 0;
  let lastOrderAt: string | null = null;
  let todayActiveOrders = 0;
  const todayKey = localDayKey(now);

  for (const order of orders) {
    if (isVoided(order.status)) continue;
    const created = new Date(order.creationDate);
    if (Number.isNaN(created.getTime())) continue;
    const key = localDayKey(created);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    windowRevenue += order.totalPrice || 0;
    windowOrders += 1;
    if (!lastOrderAt || created > new Date(lastOrderAt)) lastOrderAt = order.creationDate;
    if (key === todayKey) {
      todayRevenue += order.totalPrice || 0;
      todayOrders += 1;
      if (activeCodes.has(order.code)) todayActiveOrders += 1;
    }
  }

  const avgCheckIsWindow = todayOrders === 0;
  const avgCheck = avgCheckIsWindow
    ? windowOrders > 0
      ? windowRevenue / windowOrders
      : 0
    : todayRevenue / todayOrders;

  return {
    todayRevenue,
    todayOrders,
    avgCheck,
    avgCheckIsWindow,
    week: buildWeek(perDay, now),
    windowOrders,
    weeks: WEEKS,
    lastOrderAt,
    todayActiveOrders,
  };
}

/**
 * Сводка по заказам для виджета «Заказы»: сегодняшние суммы и заказы по дням
 * текущей недели. История за 8 недель нужна только для среднего чека, когда
 * сегодня продаж ещё нет.
 */
export function useOrdersDigest(sellerId: string | null) {
  const [digest, setDigest] = useState<OrdersDigest | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      setDigest(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    const now = new Date();
    // Границы окна берём по краям локальных суток: если бэкенд усекает `dateTo`
    // до начала дня, заказы за сегодня иначе не попали бы в выборку вообще.
    const from = new Date(now);
    from.setDate(from.getDate() - WEEKS * 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    const loadArchived = async () => {
      const all: KaspiOrder[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await kaspiApi.listOrders(sellerId, {
          page,
          limit: PAGE_SIZE,
          dateFrom: from.toISOString(),
          dateTo: to.toISOString(),
        });
        all.push(...res.data);
        if (res.data.length === 0 || all.length >= res.total) break;
      }
      return all;
    };

    // Активные заказы — живой запрос в Kaspi: он требует API-токен продавца и
    // может отвалиться (нет токена, токен протух, таймаут). Тогда показываем
    // архив, а не пустой виджет.
    const loadActive = () =>
      kaspiApi.listActiveOrders(sellerId).then(
        (res) => res.data ?? [],
        () => [] as KaspiActiveOrder[],
      );

    Promise.all([loadArchived(), loadActive()])
      .then(([archived, active]) => {
        if (!cancelled) {
          // Активный список фильтров не принимает и отдаёт всё разом, включая
          // давно зависшие заказы — окно отрезаем сами, иначе средний чек за
          // 8 недель посчитается по чужому периоду.
          const fromTime = from.getTime();
          const inWindow = active.filter((o) => {
            const created = new Date(o.creationDate).getTime();
            return !Number.isNaN(created) && created >= fromTime;
          });
          const activeCodes = new Set(inWindow.map((o) => o.code));
          setDigest(aggregate(mergeOrders(archived, inWindow), now, activeCodes));
        }
      })
      .catch(() => {
        if (!cancelled) setDigest(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  return { digest, isLoading };
}
