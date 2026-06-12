# FuelStation OS Implementation Plan

## 1. Product Intent

FuelStation OS should become a subscription-ready operations platform for independent filling stations and station groups.

The first release must replace the Excel workbook for one pilot filling station. Later releases can expand into inventory, accounting integrations, staff shifts, supplier reconciliation, and owner notifications.

## 2. MVP Scope

### Included

- Multi-tenant account model
- Company/tenant setup
- One or more stations per tenant
- Users and roles
- Product setup
- Pump, nozzle, and tank setup
- Daily pump meter readings
- Tank dipping
- Product discharge records
- Cash collection book
- Expenditure book
- Mart sales book
- Daily close dashboard
- Owner dashboard
- Role-based sidebar groups and menu items
- Excel/PDF export for daily close reports
- Audit log for create/update/delete events

### Not In MVP

- Full accounting system
- Payroll
- Deep inventory for every mart SKU
- Automated bank feed integration
- POS hardware integration
- IoT tank gauge integration
- Mobile app

## 3. Recommended Stack

Use a conservative full-stack TypeScript build:

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Auth.js or Better Auth
- Zod for validation
- Recharts for dashboard charts
- ExcelJS for Excel exports
- Playwright for UI tests
- Vitest for unit tests
- Docker Compose for production
- GitHub Actions for CI/CD
- DigitalOcean Droplet for first deployment

## 4. Repository Shape

```text
FuelStation_OS/
  app/
    src/
      app/
      components/
      features/
      lib/
      server/
      styles/
    prisma/
    public/
    tests/
    package.json
    Dockerfile
  docs/
  deploy/
  infra/
  .github/
    workflows/
```

Keep all application code inside `app/`. Keep deployment scripts in `deploy/`. Keep human-readable build instructions in `docs/`.

## 5. Core Domains

### Tenant Administration

- Tenant profile
- Subscription status
- Tenant owner users
- Station list
- Role assignment
- Role-based menu visibility

### Station Setup

- Products
- Product price history
- Tanks
- Pumps
- Nozzles
- Attendants
- Supervisors

### Forecourt Daily Close

- Date and shift
- Pump/nozzle meter opening and closing readings
- Litres sold
- Price per litre
- Expected amount
- Cash received
- Variance
- Supervisor approval status

### Tank Control

- Opening stock litres
- Product receipts
- Closing dip
- Closing stock litres
- Meter sold litres pulled from pump readings
- Variance/loss
- Water test
- Supervisor notes

### Product Discharge

- Supplier
- Invoice number
- Product
- Seal numbers
- Compartment readings
- Before tank reading
- Expected quantity
- After tank reading
- Difference/shortage
- Driver/dealer signature capture later

### Cash Collection

- Amount to bank
- Bank collection date
- Bank reference
- Expected cash
- Variance
- Supervisor sign-off

### Expenditure

- Voucher/reference
- Category
- Amount
- Paid by
- Approved by
- Receipt attached
- Description

### Mart Sales

- POS sales
- Cash sales
- Mobile money
- Returns
- Net mart sales
- Cash count
- Variance

## 6. Business Rules

```text
litres_sold = current_meter_reading - previous_meter_reading
expected_amount = litres_sold * active_price_per_litre
cash_variance = cash_received - expected_amount
tank_meter_sold = sum(litres_sold where date and product match)
tank_variance = opening_stock + receipts - meter_sold - closing_stock
product_discharge_difference = after_tank - before_tank - expected_quantity
mart_net_sales = pos_sales + cash_sales + mobile_money - returns
mart_variance = cash_count - mart_net_sales
net_cash_position = cash_banked + mart_net_sales - expenditure
```

## 7. UX Milestones

### Milestone 1: Static Shell

- Strategy OS-style sidebar
- Header with page title, centered search, account/avatar block
- Command Center dashboard
- Owner dashboard with cross-station KPIs, trend cards, exceptions, and insights
- Role-based sidebar/menu visibility rules
- Modal overlay component
- Empty states
- Form and table components

### Milestone 2: Setup Flow

- Tenant setup
- Station setup
- Product/tank/pump/nozzle setup
- Seed demo station using the workbook assumptions

### Milestone 3: Daily Operations

- Pump readings
- Tank dipping
- Cash collection
- Expenditure
- Mart sales
- Product discharge

### Milestone 4: Reconciliation

- Daily close dashboard
- Product-level summary
- Variance flags
- Supervisor approval workflow

### Milestone 5: Exports and Deployment

- Excel export
- PDF export
- CI/CD
- DigitalOcean Droplet deployment

## 8. Antigravity Build Instructions

1. Initialize a clean Git repo in `D:\DEV\FuelStation_OS`.
2. Scaffold the Next.js TypeScript app inside `app/`.
3. Build the Strategy OS shell first before implementing deep business logic.
4. Keep components reusable and domain-specific.
5. Implement tenant isolation in every server-side query.
6. Add seed data for one demo tenant and one demo station.
7. Do not add broad dependencies unless needed.
8. Write tests for business calculations before building all screens.
9. Use Docker locally before deploying to the Droplet.
10. Keep deployment secrets out of Git.

## 9. Role-Based Menu Policy

Navigation must be generated from a server-approved permission model, not hardcoded only in the client. The frontend can hide items for usability, but backend routes and APIs must enforce the same permissions.

Suggested role access:

| Menu Area | Owner | Admin | Station Manager | Supervisor | Attendant | Accountant | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Owner Dashboard | Yes | Yes | No | No | No | View | View |
| Station Dashboard | Yes | Yes | Yes | Yes | View | View | View |
| Daily Close | Yes | Yes | Yes | Yes | Entry | View | View |
| Pump Readings | Yes | Yes | Yes | Yes | Entry | View | View |
| Tank Dipping | Yes | Yes | Yes | Yes | No | View | View |
| Product Discharge | Yes | Yes | Yes | Yes | No | View | View |
| Cash Collection | Yes | Yes | Yes | Yes | No | Entry | View |
| Expenditure | Yes | Yes | Yes | Yes | No | Entry | View |
| Mart Sales | Yes | Yes | Yes | Yes | Entry | View | View |
| Setup | Yes | Yes | Limited | No | No | No | View |
| Reports | Yes | Yes | Yes | Yes | No | Yes | Yes |
| Audit Log | Yes | Yes | No | No | No | View | Yes |
| Subscription | Yes | Admin if granted | No | No | No | No | No |

Menu visibility must also respect station assignment. A station-level user should only see assigned stations.

## 10. Owner Dashboard Requirements

The owner dashboard is a first-class module, separate from the station dashboard.

It must support:

- All-station selector and individual station drilldown.
- Date range comparison.
- Total litres by product.
- Expected revenue.
- Cash banked.
- Banking variance.
- Tank variance/loss by product and station.
- Mart net sales.
- Expenditure.
- Net cash position.
- Exception list ranked by financial impact.
- Trend cards for day/week/month.
- Station performance comparison.
- Export to PDF/Excel.
- Insight cards that explain the highest-risk variances in plain language.
