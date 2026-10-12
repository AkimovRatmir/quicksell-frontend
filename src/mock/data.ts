/**
 * Demo data for the «Аналитика продаж» section of the Products page — profit
 * concentration, ABC groups and turnover leaders need per-product sales that the
 * current backend endpoints don't expose yet. Everything else on the app now
 * runs on real API data. Clearly labelled «демо» in the UI.
 */

export const profitConcentration = [
  { name: 'Чехол iPhone 15 Pro', pct: 26, color: '#7F77DD' },
  { name: 'Зарядка MagSafe', pct: 21, color: '#AFA9EC' },
  { name: 'Наушники TWS Pro', pct: 17, color: '#C5C1EC' },
  { name: 'Кабель USB-C 2м', pct: 12, color: '#D9D7F5' },
  { name: 'Мышь беспроводная', pct: 8, color: '#E8E6FA' },
  { name: 'Остальные 34 SKU', pct: 16, color: '#f0f0f0' },
];

export const abcGroups = {
  a: { count: 8, profitSharePct: 80 },
  b: { count: 12, profitSharePct: 15 },
  c: { count: 18, profitSharePct: 5 },
};

export const turnoverLeaders = [
  { name: 'Кабель USB-C 2м', unitsPerMonth: 87 },
  { name: 'Чехол iPhone 15 Pro', unitsPerMonth: 48 },
  { name: 'Зарядка MagSafe', unitsPerMonth: 32 },
];
