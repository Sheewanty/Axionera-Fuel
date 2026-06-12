# Role Permission Matrix

Use this as the initial source of truth for sidebar rendering, route guards, and API authorization.

## Roles

```text
OWNER
ADMIN
STATION_MANAGER
SUPERVISOR
ATTENDANT
ACCOUNTANT
AUDITOR
```

## Permission Principles

- Menus are generated from permissions.
- API routes enforce permissions independently of menu visibility.
- Station-level users only access assigned stations.
- Tenant owners can see all stations under their tenant.
- Audit logs must record permission-sensitive actions.

## Menu Permissions

| Sidebar Group | Menu Item | OWNER | ADMIN | STATION_MANAGER | SUPERVISOR | ATTENDANT | ACCOUNTANT | AUDITOR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command Center | Owner Dashboard | Full | Full | None | None | None | View | View |
| Command Center | Station Dashboard | Full | Full | Full | Full | View | View | View |
| Command Center | Daily Close | Full | Full | Full | Full | Entry | View | View |
| Command Center | Alerts | Full | Full | Full | Full | View | View | View |
| Forecourt Operations | Pump Readings | Full | Full | Full | Full | Entry | View | View |
| Forecourt Operations | Tank Dipping | Full | Full | Full | Full | None | View | View |
| Forecourt Operations | Product Discharge | Full | Full | Full | Full | None | View | View |
| Forecourt Operations | Variance Review | Full | Full | Full | Full | None | View | View |
| Cash & Banking | Cash Collection | Full | Full | Full | Full | None | Entry | View |
| Cash & Banking | Bank Deposits | Full | Full | Full | Full | None | Entry | View |
| Cash & Banking | Expenditure | Full | Full | Full | Full | None | Entry | View |
| Cash & Banking | Cash Variance | Full | Full | Full | Full | None | View | View |
| Mart Operations | Mart Sales | Full | Full | Full | Full | Entry | View | View |
| Mart Operations | Returns | Full | Full | Full | Full | Entry | View | View |
| Mart Operations | Cash Count | Full | Full | Full | Full | Entry | View | View |
| Mart Operations | Mart Summary | Full | Full | Full | Full | View | View | View |
| Setup | Company | Full | Full | None | None | None | None | View |
| Setup | Stations | Full | Full | View | None | None | None | View |
| Setup | Products & Prices | Full | Full | Limited | None | None | None | View |
| Setup | Pumps & Nozzles | Full | Full | Limited | None | None | None | View |
| Setup | Tanks | Full | Full | Limited | None | None | None | View |
| Setup | Users & Roles | Full | Full | None | None | None | None | View |
| Reports | Daily Reports | Full | Full | Full | Full | None | Full | View |
| Reports | Product Sales | Full | Full | Full | Full | None | Full | View |
| Reports | Tank Loss | Full | Full | Full | Full | None | View | View |
| Reports | Banking | Full | Full | Full | Full | None | Full | View |
| Reports | Exports | Full | Full | Full | Full | None | Full | View |
| Administration | Subscription | Full | Granted | None | None | None | None | None |
| Administration | Audit Log | Full | Full | None | None | None | View | Full |
| Administration | Integrations | Full | Full | None | None | None | None | View |
| Administration | Security | Full | Full | None | None | None | None | View |

Permission labels:

- `Full`: create, read, update, delete or approve as appropriate.
- `Entry`: create/update own assigned operational entries, no approval.
- `Limited`: manage station-level setup but not tenant-wide settings.
- `View`: read-only.
- `Granted`: only if an explicit permission flag is assigned.
- `None`: no menu item and no route/API access.

## Owner Dashboard Permissions

Owner dashboard data must include all stations in the tenant by default.

Allowed:

- OWNER: full access.
- ADMIN: full access unless tenant policy disables it.
- ACCOUNTANT: financial view only.
- AUDITOR: read-only compliance view.

Not allowed:

- STATION_MANAGER, SUPERVISOR, ATTENDANT unless explicitly granted.

## Implementation Hint

Represent menu items as structured config:

```ts
type AccessLevel = "full" | "entry" | "limited" | "view" | "granted" | "none";

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  requiredAccess: Partial<Record<Role, AccessLevel>>;
  stationScoped: boolean;
};
```

Filter visible nav items server-side where possible, then hydrate the client shell with the approved menu.
