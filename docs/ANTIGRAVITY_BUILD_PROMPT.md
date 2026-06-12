# Antigravity Build Prompt

Build FuelStation OS in this repository.

## Objective

Create a production-ready, multi-tenant SaaS application for filling station operations. The app should replace the Excel workbook workflow for daily station control and support future subscription sales to other filling stations.

## Non-Negotiable UI Requirement

The UI shell must mimic Strategy OS exactly:

- Navy sidebar that is collapsed by default and expands on hover.
- Grouped sidebar menu with icons and labels.
- Navy header.
- Header title on the left.
- Search box centered in the header.
- Station switcher, user name, user role/tenant label, and gold circular avatar on the right.
- Sidebar groups and menu items must be role-based.
- Modal overlays/popups matching Strategy OS interaction style.
- Dense operational tables and KPI cards.
- Axionera palette: navy `#162750`, gold `#966C44`, white, grey surfaces, semantic green/amber/red.
- Inter body font and DM Serif Text heading font.

Reference files:

```text
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\header.ejs
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\footer.ejs
D:\DEV\STRAT_OS_3.0\frontend\style.css
D:\DEV\STRAT_OS_3.0\frontend\modules\nav.js
```

Do not copy Strategy OS business pages. Rebuild the shell and patterns for FuelStation OS.

## Technical Target

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Auth.js or Better Auth
- Zod
- Vitest
- Playwright
- Docker
- GitHub Actions
- DigitalOcean Droplet deployment

## First Build Milestone

Create a working vertical slice:

1. Login page.
2. Strategy OS-style app shell.
3. Tenant/station seed data.
4. Command Center dashboard.
5. Owner dashboard with cross-station analytics and insights.
6. Role-based sidebar rendering.
7. Pump readings page.
8. Tank dipping page.
9. Cash collection page.
10. Daily Summary page.
11. Formula/business calculation tests.
12. Docker local run.

## Data Rules

Every operational query must be scoped by:

```text
tenant_id
station_id
```

Navigation and route access must be permission-based. Hidden menu items are not security; enforce authorization in server code.

Never trust client-side calculations. Server-side services must recompute:

```text
litres_sold
expected_amount
cash_variance
tank_meter_sold
tank_variance
product_discharge_difference
mart_net_sales
mart_variance
net_cash_position
```

## MVP Acceptance

Use `docs/MVP_ACCEPTANCE_CRITERIA.md` as the definition of done.

Use `docs/ROLE_PERMISSION_MATRIX.md` as the source of truth for role-based sidebar rendering and authorization.

## Output Expectations

Create:

- Complete app scaffold in `app/`.
- Prisma schema and migrations.
- Seed script.
- Reusable shell/components.
- Business calculation services.
- Unit tests.
- UI tests for shell and daily close flow.
- Dockerfile.
- Updated CI workflows if package scripts differ from the provided skeleton.
