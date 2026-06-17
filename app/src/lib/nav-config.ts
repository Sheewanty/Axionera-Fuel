export type Role =
  | "SUPER_ADMIN"
  | "OWNER"
  | "ADMIN"
  | "STATION_MANAGER"
  | "SUPERVISOR"
  | "ATTENDANT"
  | "ACCOUNTANT"
  | "AUDITOR";

/**
 * AccessLevel values — explicit allow set:
 *  full           — read + write + approve (OWNER, ADMIN, STATION_MANAGER)
 *  entry          — create/edit their own records only (SUPERVISOR, ATTENDANT)
 *  limited        — restricted write (e.g. prices: edit not create) (ACCOUNTANT)
 *  view           — read-only across the module
 *  explicit_grant — view-only for a SPECIFIC screen, granted individually.
 *                   This is NOT a blanket read right; it must be paired with a
 *                   server-side check that confirms the grant is still valid.
 *                   Future: backed by a PermissionGrant table (M3).
 *                   Current: nav visibility only — server component must call
 *                   requireRole() before rendering sensitive data.
 *  none           — no access; omitting a role from the access map is equivalent.
 */
export type AccessLevel = "full" | "entry" | "limited" | "view" | "explicit_grant" | "none";


/** Access levels that allow a nav item to be shown in the sidebar */
const CAN_SEE_NAV: ReadonlySet<AccessLevel> = new Set([
  "full", "entry", "limited", "view", "explicit_grant",
]);

/** Access levels that allow creating / editing records */
const CAN_WRITE: ReadonlySet<AccessLevel> = new Set(["full", "entry", "limited"]);

/** Access levels that allow approval / sign-off actions */
const CAN_APPROVE: ReadonlySet<AccessLevel> = new Set(["full"]);

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Roles that may access this item and their level. Omitting a role is equivalent to "none". */
  access: Partial<Record<Role, AccessLevel>>;
  stationScoped: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}



export const NAV_CONFIG: NavGroup[] = [
  {
    id: "platform-admin",
    label: "Super Admin",
    icon: "shield-halved",
    items: [
      {
        label: "Companies",
        href: "/platform/tenants",
        icon: "building",
        stationScoped: false,
        access: { SUPER_ADMIN: "full" },
      },
    ],
  },
  {
    id: "command-center",
    label: "Command Center",
    icon: "gauge-high",
    items: [
      {
        label: "Owner Dashboard",
        href: "/owner-dashboard",
        icon: "chart-pie",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Station Dashboard",
        href: "/command-center",
        icon: "tachometer-alt",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "view", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Daily Close",
        href: "/daily-close",
        icon: "clipboard-check",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "entry", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Alerts",
        href: "/alerts",
        icon: "bell",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "view", ACCOUNTANT: "view", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "forecourt-operations",
    label: "Forecourt Operations",
    icon: "gas-pump",
    items: [
      {
        label: "Pump Readings",
        href: "/forecourt/pump-readings",
        icon: "gauge",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "entry", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Tank Dipping",
        href: "/forecourt/tank-dipping",
        icon: "flask",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Product Discharge",
        href: "/forecourt/product-discharge",
        icon: "truck-ramp-box",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Variance Review",
        href: "/forecourt/variance-review",
        icon: "triangle-exclamation",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "cash-banking",
    label: "Cash & Banking",
    icon: "building-columns",
    items: [
      {
        label: "Cash Collection",
        href: "/forecourt/cash-entries",
        icon: "money-bill-wave",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "entry", AUDITOR: "view" },
      },
      {
        label: "Bank Deposits",
        href: "/cash/bank-deposits",
        icon: "landmark",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "entry", AUDITOR: "view" },
      },
      {
        label: "Expenditure",
        href: "/cash/expenditure",
        icon: "receipt",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "entry", AUDITOR: "view" },
      },
      {
        label: "Payment Details",
        href: "/cash/payment-details",
        icon: "file-invoice-dollar",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "entry", AUDITOR: "view" },
      },
      {
        label: "Creditors",
        href: "/cash/creditors",
        icon: "users",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "entry", AUDITOR: "view" },
      },
      {
        label: "Cash Variance",
        href: "/cash/variance",
        icon: "scale-balanced",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "mart-operations",
    label: "Mart Operations",
    icon: "store",
    items: [
      {
        label: "Mart Sales",
        href: "/mart/sales",
        icon: "cash-register",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "entry", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Returns",
        href: "/mart/returns",
        icon: "arrow-rotate-left",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "entry", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Cash Count",
        href: "/mart/cash-count",
        icon: "coins",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "entry", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Mart Summary",
        href: "/mart/summary",
        icon: "chart-bar",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ATTENDANT: "view", ACCOUNTANT: "view", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    icon: "sliders",
    items: [
      {
        label: "Company",
        href: "/setup/company",
        icon: "building",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", AUDITOR: "view" },
      },
      {
        label: "Stations",
        href: "/setup/stations",
        icon: "map-location-dot",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "view", AUDITOR: "view" },
      },
      {
        label: "Products & Prices",
        href: "/setup/products",
        icon: "tags",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "limited", AUDITOR: "view" },
      },
      {
        label: "Pumps & Nozzles",
        href: "/setup/pumps",
        icon: "plug",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "limited", AUDITOR: "view" },
      },
      {
        label: "Tanks",
        href: "/setup/tanks",
        icon: "database",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "limited", AUDITOR: "view" },
      },
      {
        label: "Users & Roles",
        href: "/setup/users",
        icon: "users-gear",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "chart-line",
    items: [
      {
        label: "Daily Reports",
        href: "/reports/daily",
        icon: "calendar-day",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "full", AUDITOR: "view" },
      },
      {
        label: "Product Sales",
        href: "/reports/product-sales",
        icon: "chart-column",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "full", AUDITOR: "view" },
      },
      {
        label: "Tank Loss",
        href: "/reports/tank-loss",
        icon: "droplet-slash",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "view", AUDITOR: "view" },
      },
      {
        label: "Banking",
        href: "/reports/banking",
        icon: "file-invoice-dollar",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "full", AUDITOR: "view" },
      },
      {
        label: "Exports",
        href: "/reports/exports",
        icon: "file-export",
        stationScoped: true,
        access: { OWNER: "full", ADMIN: "full", STATION_MANAGER: "full", SUPERVISOR: "full", ACCOUNTANT: "full", AUDITOR: "view" },
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "shield-halved",
    items: [
      {
        label: "Subscription",
        href: "/admin/subscription",
        icon: "credit-card",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "explicit_grant" },
      },
      {
        label: "Audit Log",
        href: "/admin/audit-log",
        icon: "clock-rotate-left",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", ACCOUNTANT: "view", AUDITOR: "full" },
      },
      {
        label: "Integrations",
        href: "/admin/integrations",
        icon: "plug-circle-check",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", AUDITOR: "view" },
      },
      {
        label: "Security",
        href: "/admin/security",
        icon: "lock",
        stationScoped: false,
        access: { OWNER: "full", ADMIN: "full", AUDITOR: "view" },
      },
    ],
  },
];

/** Returns only the nav groups/items the given role can see in the sidebar */
export function filterNavForRole(role: Role): NavGroup[] {
  return NAV_CONFIG.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const level = item.access[role];
      return level !== undefined && CAN_SEE_NAV.has(level);
    }),
  })).filter((group) => group.items.length > 0);
}

/** Returns true if the role has any meaningful access level to this item */
export function hasAccess(role: Role, access: Partial<Record<Role, AccessLevel>>): boolean {
  const level = access[role];
  return level !== undefined && CAN_SEE_NAV.has(level);
}

/** Returns true if the role may create or edit records for this item */
export function canWrite(role: Role, access: Partial<Record<Role, AccessLevel>>): boolean {
  const level = access[role];
  return level !== undefined && CAN_WRITE.has(level);
}

/** Returns true if the role may approve or sign-off records */
export function canApprove(role: Role, access: Partial<Record<Role, AccessLevel>>): boolean {
  const level = access[role];
  return level !== undefined && CAN_APPROVE.has(level);
}
