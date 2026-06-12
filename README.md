# FuelStation OS

FuelStation OS is a planned multi-tenant station operations platform for filling stations, based on the field workbook created for daily forecourt control.

The application should replace the workbook over time while preserving the same operational controls:

- Pump meter readings
- Tank dipping and variance checks
- Product discharge records
- Cash collection and banking variance
- Expenditure book
- Mart sales and cash variance
- Daily close dashboard
- Owner-level multi-station reporting

## Build Direction

Use this repository as the clean application folder for Antigravity development.

Primary plan:

- Build a multi-tenant SaaS app.
- Mimic the Strategy OS UI shell exactly: sidebar, header, global search, avatar/account area, cards, popups, modal overlays, and dense operational tables.
- Make sidebar menu groups and menu items role-based.
- Include an owner dashboard for cross-station analysis, insights, exceptions, and subscription-level management.
- Deploy first production version to a DigitalOcean Droplet using Docker Compose.
- Use GitHub Actions for CI/CD.

## GitHub Remote

```text
origin: https://github.com/Sheewanty/Axionera-Fuel.git
```

## Key Documents

- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Strategy OS UI Contract](docs/STRATEGY_OS_UI_CONTRACT.md)
- [Data Model](docs/DATA_MODEL.md)
- [CI/CD and DigitalOcean Deployment](docs/CI_CD_DIGITALOCEAN.md)
- [MVP Acceptance Criteria](docs/MVP_ACCEPTANCE_CRITERIA.md)

## Reference UI Source

The Strategy OS reference currently exists locally at:

```text
D:\DEV\STRAT_OS_3.0
```

Important reference files:

```text
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\header.ejs
D:\DEV\STRAT_OS_3.0\backend\src\views\partials\footer.ejs
D:\DEV\STRAT_OS_3.0\frontend\style.css
D:\DEV\STRAT_OS_3.0\frontend\modules\nav.js
```

Do not copy domain-specific Strategy OS pages directly. Recreate the shell, visual system, component behavior, and interaction patterns for the filling station domain.
