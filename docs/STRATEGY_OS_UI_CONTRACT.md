# Strategy OS UI Contract For FuelStation OS

The FuelStation OS interface must mimic the Strategy OS UI shell exactly enough that an existing Strategy OS user recognizes the same product family.

Reference source:

```text
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\header.ejs
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\footer.ejs
D:\DEV\STRAT_OS_3.0\frontend\style.css
D:\DEV\STRAT_OS_3.0\frontend\modules\nav.js
```

## Visual Identity

Use the Axionera brand palette:

```css
--ax-blue: #162750;
--ax-gold: #966C44;
--ax-white: #FFFFFF;
--ax-grey-text: #64748B;
--ax-border: #CBD5E1;
--ax-surface: #F8FAFC;
--ax-green: #15803D;
--ax-amber: #D97706;
--ax-red: #B91C1C;
```

Typography:

- Body: Inter
- Headings: DM Serif Text
- Icons: Font Awesome in Strategy OS, or Lucide if converting to React. If using Lucide, match icon weight and sizing closely.

## Layout Shell

### Sidebar

Behavior:

- Fixed/sticky left sidebar.
- Collapsed width about `52px`.
- Expands on hover to about `270px`.
- Dark navy background.
- Round logo at top.
- Grouped nav sections.
- Icons always visible.
- Text labels hidden when collapsed and visible when expanded.
- Active item uses gold indicator/color.

FuelStation OS sidebar groups:

1. Command Center
   - Owner Dashboard
   - Station Dashboard
   - Daily Close
   - Alerts

2. Forecourt Operations
   - Pump Readings
   - Tank Dipping
   - Product Discharge
   - Variance Review

3. Cash & Banking
   - Cash Collection
   - Bank Deposits
   - Expenditure
   - Cash Variance

4. Mart Operations
   - Mart Sales
   - Returns
   - Cash Count
   - Mart Summary

5. Setup
   - Company
   - Stations
   - Products & Prices
   - Pumps & Nozzles
   - Tanks
   - Users & Roles

6. Reports
   - Daily Reports
   - Product Sales
   - Tank Loss
   - Banking
   - Exports

7. Administration
   - Subscription
   - Audit Log
   - Integrations
   - Security

## Role-Based Menu Visibility

The visible sidebar must be role-aware. Menu groups and items should be rendered from a central navigation config with required permissions.

Roles:

- Owner
- Admin
- Station Manager
- Supervisor
- Attendant
- Accountant
- Auditor

Minimum behavior:

- Owner sees all groups, all stations, and owner-level analytics.
- Admin sees all operational and setup areas except billing/subscription unless explicitly granted.
- Station Manager sees assigned station operations, reports, and limited setup.
- Supervisor sees daily operations, daily close, and station reports for assigned station.
- Attendant sees only assigned data-entry workflows such as pump readings and mart entry.
- Accountant sees cash collection, expenditure, banking reports, and financial summaries.
- Auditor sees read-only reports and audit logs.

Never rely on hidden menu items as security. Route/API authorization must enforce the same permissions.

### Header

Must include:

- Left: page title and optional subtitle.
- Center: global search box.
- Right: station switcher, user name, role/tenant label, circular avatar.

Header must use dark navy background with white text, matching the Strategy OS override style.

Search box:

- White pill/rounded rectangle.
- Search icon.
- Placeholder such as `Search stations, days, invoices...`.

Avatar:

- Gold circular avatar.
- Initials in white.

### Main Content

Use:

- Light grey canvas.
- Dense operational layout.
- Cards for KPI summaries only.
- Tables for daily entry and records.
- Modals for create/edit actions.
- Drawer or modal for detail review.

Do not create a marketing landing page. The first screen after login is the Command Center dashboard.

## Components To Build

### Required Shell Components

- `AppShell`
- `Sidebar`
- `SidebarGroup`
- `Header`
- `GlobalSearch`
- `UserAccount`
- `StationSwitcher`
- `Modal`
- `ConfirmDialog`
- `DataTable`
- `KpiCard`
- `StatusBadge`
- `VarianceBadge`
- `PageTitle`
- `Toolbar`

### Modal Behavior

Strategy OS uses modal overlays for preview, confirmation, system messages, and prompt dialogs. FuelStation OS should provide:

- Add pump reading modal
- Add tank dipping modal
- Add product discharge modal
- Close day confirmation modal
- Variance explanation modal
- Export report modal

Modal requirements:

- Semi-opaque overlay.
- Centered content.
- Header with title and close icon.
- Body with form/detail content.
- Footer with Cancel and primary action.
- Escape key closes if there is no unsaved data.

## Page Patterns

### Command Center

Top KPI row:

- Total litres sold today
- Expected forecourt cash
- Cash banked
- Tank variance/loss
- Mart net sales
- Open exceptions

Below:

- Daily close status by station
- Product sales table
- Alerts and unresolved variances

### Owner Dashboard

The owner dashboard is available to Owner and authorized Admin roles.

It must include:

- Cross-station KPI cards.
- Station comparison table.
- Product sales trend.
- Banking variance trend.
- Tank loss/variance trend.
- Mart sales trend.
- Top exceptions by amount and operational risk.
- Insight cards with short explanations and recommended follow-up.
- Drilldown links into station daily close records.

The owner dashboard should feel like Strategy OS Command Center adapted to fuel station operations.

### Data Entry Pages

Each data-entry page should have:

- Page title
- Date/station filters
- Primary action button
- Data table
- Inline computed columns styled as non-entry/calculated columns
- Variance columns with red/amber/green badges

Calculated cells/columns should be visually distinct but not locked in MVP web UI.

## Responsiveness

Desktop first. The target workflow is station office and manager laptop use.

Minimum expectations:

- No text overlap.
- Header remains readable down to tablet width.
- Sidebar can collapse.
- Tables can horizontally scroll.

## Exact Mimic Notes

Match these Strategy OS traits:

- Navy shell
- Gold active accents
- Inter + DM Serif Text pairing
- Hover-expanding sidebar
- Grouped nav menu
- Header with search and avatar
- Modal overlay look and behavior
- Dense cards/tables, not marketing hero sections
