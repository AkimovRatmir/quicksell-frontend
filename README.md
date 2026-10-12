# QuickSell — analytics for Kaspi.kz sellers (frontend)

The web app of QuickSell, a SaaS product for sellers on [Kaspi.kz](https://kaspi.kz),
Kazakhstan's largest marketplace. It showed a store's real profit after Kaspi commission, delivery
and cost of goods, product-level statistics, a unit-economics calculator and AI recommendations.

It ran in production in September 2026 and has since been shut down. The code is published as a
portfolio project. The interface is in Russian.

Backend: [quicksell-backend](https://github.com/AkimovRatmir/quicksell-backend) · NestJS + PostgreSQL

## Screens

- **Главная (Dashboard):** revenue, net profit and margin for the chosen period, today's orders,
  an orders heatmap, AI insight, problems and growth points.
- **Прибыль и расходы (Finance):** profit breakdown by expense category, monthly trend, orders.
- **Товарная статистика (Products):** per-product sales, profit, margin, returns, ABC analysis and
  profit concentration.
- **Юнит-экономика:** a calculator for a product's price, costs, ROI and recommended price.
- **Настройки (Settings):** connecting a Kaspi store (including the emailed confirmation code),
  expense categories, business goals, cost of goods with bulk fill.
- **Тариф (Plans):** Free / Pro. Payment runs in a popup with the payment provider's hosted form,
  with no redirect away from the app.
- **Admin panel:** users, plans and store health, for admins only.
- Sign-up with a step-by-step setup wizard and legal consent, plus password reset.

## Details worth a look

- Freemium gating: Pro sections are blurred behind a lock with an upgrade flow instead of being
  hidden, so users see what they'd get.
- The payment popup polls the backend for the outcome. The page the provider returns to inside the
  iframe only sends a "check now" signal to the parent window; the result always comes from the
  server, never from the URL.
- Full phone layout: a drawer menu, stacked cards and scrollable tables, checked on every screen.
- Error boundaries per section, so one broken widget doesn't blank the app. Backend errors are
  shown in Russian.

## Stack

TypeScript · React 18 · Vite · React Router · Chart.js · Axios · plain CSS

## Running locally

Requires Node.js 18+ and the [backend](https://github.com/AkimovRatmir/quicksell-backend) running on `localhost:3000`.

```bash
npm ci
npm run dev        # http://localhost:5173, /api is proxied to the backend
```

The legal documents (offer, privacy policy, payment terms) linked from the sign-up and payment
screens are not included in this repository.

## Authors

- **Vladislav Shivarev**: design and UI
- **Ratmir Akimov**: admin panel, payments, phone layout, backend integration

## License

All rights reserved. The code is published for viewing only. See [LICENSE](LICENSE).
