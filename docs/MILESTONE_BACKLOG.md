# Milestone Backlog

Status legend:

- `[x]` Done
- `[ ]` Remaining
- `_In progress_` Partly implemented, still needs hardening

## M0: Repository And Scaffold

- [x] Initialize app in `app/`.
- [x] Add Next.js TypeScript.
- [x] Add Tailwind.
- [x] Add Prisma.
- [x] Add lint/typecheck/test/build scripts.
- [x] Add Dockerfile.
- [x] Make local CI checks pass.
- [ ] GitHub Actions deployment reliability. _In progress_

## M1: Strategy OS Shell

- [x] AppShell
- [x] Sidebar
- [x] SidebarGroup
- [x] Header
- [x] GlobalSearch
- [x] StationSwitcher
- [x] UserAccount
- [x] RoleBasedNavigation
- [x] Modal
- [x] ConfirmDialog
- [x] KPI card
- [x] Status/variance badge
- [x] Data table base component

Acceptance:

- [x] Screenshot visually resembles Strategy OS shell.
- [x] Header has search and avatar.
- [x] Sidebar expands on hover.
- [x] Sidebar menu changes by role and assigned station permissions.
- [x] Modals match Strategy OS overlay pattern.

## M2: Tenancy And Setup

- [x] Auth
- [x] Tenant model
- [x] Station model
- [x] User membership/roles
- [x] Role-based menu config
- [x] Product setup
- [x] Price history
- [x] Pump setup
- [x] Nozzle setup
- [x] Tank setup
- [x] Super-admin tenant controls
- [x] Demo/import tenant seed path
- [ ] Fine-grained PermissionGrant model. _Deferred_
- [ ] Password policy hardening beyond first-login reset. _Remaining_

Acceptance:

- [x] Tenant user cannot access another tenant.
- [x] Users cannot access menu/API areas outside their role permissions.
- [x] Demo station matches the workbook pump layout.

## M3: Daily Operations

- [x] Daily session open/close
- [x] Pump readings
- [x] Opening and closing meter workflow
- [x] Tank dipping
- [x] Product discharge
- [x] Cash collection
- [x] Expenditure
- [x] Mart sales summary
- [x] Lube bay sales
- [x] Debtor sales and payments
- [x] Duplicate-entry safeguards for cash collection

Acceptance:

- [x] Workbook modules exist as app pages.
- [x] Calculations match the approved business rules.
- [x] Variance columns are clearly styled.

## M4: Review And Approval

- [x] Daily close dashboard
- [x] Owner dashboard
- [x] Cross-station analytics
- [x] Tenant-scoped dashboard data
- [x] Supervisor ready-for-review action
- [x] Manager approval/reopen action
- [x] Reopen reason capture
- [x] Audit log
- [ ] Variance explanation modal. _Remaining_
- [ ] Alert escalation workflow. _Remaining_

Acceptance:

- [x] Day can move from OPEN to READY_FOR_REVIEW to APPROVED.
- [x] Reopening requires reason.

## M5: Reports And Export

- [x] Reports Hub UI
- [x] Report Library UI
- [x] Daily station control report
- [x] Owner executive daily brief
- [x] Pump sales report
- [x] Tank dip report
- [x] Tank loss / fuel variance report
- [x] Cash reconciliation report
- [x] Bank deposit report
- [x] Credit sales / debtors report
- [x] Expense report
- [x] Lube bay services report
- [x] Technician performance report
- [x] PDF generation
- [x] PPTX generation
- [x] Tenant/station-scoped report downloads
- [ ] Report scheduling and email delivery. _Remaining_
- [ ] AI commentary on generated reports. _Remaining_
- [ ] Excel daily close export. _Remaining unless superseded by import/export templates_

Acceptance:

- [x] Exported PDF/PPTX reports are generated from app data.
- [ ] Scheduled reports agree with dashboard numbers. _Remaining_

## M6: Production Deployment

- [x] Docker Compose production path
- [x] Caddy HTTPS
- [x] Droplet bootstrap
- [x] Health checks
- [x] Manual deployment path
- [x] `fuelstationos.com` domain setup
- [ ] GitHub Actions deployment. _In progress due environment secrets/deploy reliability_
- [ ] Automated backup job and restore drill. _In progress_

Acceptance:

- [ ] Push to main deploys to Droplet. _In progress_
- [x] App is reachable over HTTPS after manual deploy.
- [ ] Database backup runs successfully on a documented schedule. _Remaining_

## Commercial Roadmap

- [ ] Excel import history, row-level validation, and controlled restore workflows. _Next sprint / in progress_
- [ ] Variance explanation modal and alert escalation. _Next sprint_
- [ ] Mobile app for owners and managers. _Next sprint discovery_
- [ ] Report scheduling and email/SMS delivery.
- [ ] AI operational insights for leakage, theft, calibration, delivery loss, abnormal consumption, and attendant exceptions.
- [ ] Electronic tank probe integration.
- [ ] POS integration.
- [ ] Coupon barcode scanning.
- [ ] Real-time fuel monitoring.
- [ ] NPA compliance reports.
- [ ] Mobile Money API integration.
- [ ] GPS tracking of deliveries.

## Next Sprint Priority

### 1. Excel Import History, Row-Level Validation, And Controlled Restore

- [ ] Persist each import attempt with tenant, file name, uploaded by, status, row counts, validation errors, and timestamps.
- [ ] Add row-level validation output grouped by sheet and row number.
- [ ] Keep import execution all-or-nothing inside a transaction.
- [ ] Add controlled restore workflow for super admins only.
- [ ] Add restore preview before destructive changes.
- [ ] Keep production uploads disabled from applying partial data if validation fails.

Acceptance:

- [ ] A failed workbook clearly shows the exact sheet, row, field, and reason.
- [ ] A successful workbook produces an import history record and tenant-scoped data.
- [ ] Restore cannot run without explicit super-admin confirmation and audit trail.

### 2. Variance Explanation Modal And Alert Escalation

- [ ] Add explanation modal for pump, tank, banking, mart, debtor, and lube bay variances.
- [ ] Capture explanation text, responsible user, variance type, station, business date, and supporting status.
- [ ] Add configurable threshold rules for alert creation.
- [ ] Add escalation states: Open, Acknowledged, Investigating, Resolved.
- [ ] Surface unresolved alerts on station and owner dashboards.

Acceptance:

- [ ] A material variance cannot be silently ignored during review.
- [ ] Owners/managers can see unresolved exceptions by station and financial impact.
- [ ] Resolved alerts retain explanation and audit history.

### 3. Mobile App For Owners And Managers

- [ ] Define the mobile scope before build: responsive web/PWA first unless native-only requirements emerge.
- [ ] Prioritize owner dashboard, station dashboard, daily close status, alerts, and report downloads.
- [ ] Add mobile-safe approval/reopen flows only after alert and variance controls are stable.
- [ ] Confirm authentication/session behavior for mobile browsers.

Acceptance:

- [ ] Owner can inspect station performance and unresolved alerts from a phone.
- [ ] Manager can review daily close status without desktop-only layouts.
- [ ] No new mobile endpoint bypasses existing tenant, station, and role controls.
