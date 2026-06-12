# Milestone Backlog

## M0: Repository And Scaffold

- Initialize app in `app/`.
- Add Next.js TypeScript.
- Add Tailwind.
- Add Prisma.
- Add lint/typecheck/test/build scripts.
- Add Dockerfile.
- Make GitHub Actions pass.

## M1: Strategy OS Shell

- AppShell
- Sidebar
- SidebarGroup
- Header
- GlobalSearch
- StationSwitcher
- UserAccount
- RoleBasedNavigation
- Modal
- ConfirmDialog
- KPI card
- Status/variance badge
- Data table base component

Acceptance:

- Screenshot visually resembles Strategy OS shell.
- Header has search and avatar.
- Sidebar expands on hover.
- Sidebar menu changes by role and assigned station permissions.
- Modals match Strategy OS overlay pattern.

## M2: Tenancy And Setup

- Auth
- Tenant model
- Station model
- User membership/roles
- Permission model
- Role-based menu config
- Product setup
- Price history
- Pump setup
- Nozzle setup
- Tank setup
- Demo seed station

Acceptance:

- Tenant user cannot access another tenant.
- Users cannot access menu/API areas outside their role permissions.
- Demo station matches the workbook pump layout.

## M3: Daily Operations

- Daily session open/close
- Pump readings
- Tank dipping
- Product discharge
- Cash collection
- Expenditure
- Mart sales

Acceptance:

- All workbook modules exist as app pages.
- Calculations match workbook formulas.
- Variance columns are clearly styled.

## M4: Review And Approval

- Daily close dashboard
- Owner dashboard
- Cross-station analytics
- Insight cards
- Supervisor ready-for-review action
- Manager approval/reopen action
- Variance explanation modal
- Audit log

Acceptance:

- Day can move from OPEN to READY_FOR_REVIEW to APPROVED.
- Reopening requires reason.

## M5: Reports And Export

- Daily close Excel export
- Daily close PDF export
- Product sales report
- Tank variance report
- Banking variance report

Acceptance:

- Exported report agrees with app dashboard numbers.

## M6: Production Deployment

- Docker Compose production
- Caddy HTTPS
- GitHub Actions deployment
- Droplet bootstrap
- Health checks
- Backup job

Acceptance:

- Push to main deploys to Droplet.
- App is reachable over HTTPS.
- Database backup runs successfully.
