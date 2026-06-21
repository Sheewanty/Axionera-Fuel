"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Gauge,
  Fuel,
  Building2,
  Store,
  Settings2,
  BarChart3,
  Shield,
  Pin,
  PinOff,
} from "lucide-react";
import { filterNavForRole, type Role, type NavGroup } from "@/lib/nav-config";
import { withStationParam } from "@/lib/station-utils";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

// ─── Icon maps ────────────────────────────────────────────────────────────────
const GROUP_ICONS: Record<string, React.ElementType> = {
  "gauge-high": Gauge,
  "gas-pump": Fuel,
  "building-columns": Building2,
  "store": Store,
  "sliders": Settings2,
  "chart-line": BarChart3,
  "shield-halved": Shield,
};

const ITEM_ICONS: Record<string, React.ElementType> = {
  "chart-pie": BarChart3,
  "tachometer-alt": Gauge,
  "clipboard-check": Gauge,
  "bell": Gauge,
  "gauge": Gauge,
  "flask": Gauge,
  "truck-ramp-box": Gauge,
  "triangle-exclamation": Gauge,
  "money-bill-wave": Building2,
  "landmark": Building2,
  "receipt": Gauge,
  "scale-balanced": Gauge,
  "cash-register": Store,
  "arrow-rotate-left": Gauge,
  "coins": Building2,
  "chart-bar": BarChart3,
  "building": Building2,
  "map-location-dot": Gauge,
  "tags": Gauge,
  "plug": Gauge,
  "database": Gauge,
  "users-gear": Gauge,
  "calendar-day": Gauge,
  "chart-column": BarChart3,
  "droplet-slash": Gauge,
  "file-invoice-dollar": Gauge,
  "file-export": Gauge,
  "credit-card": Gauge,
  "clock-rotate-left": Gauge,
  "plug-circle-check": Gauge,
  "lock": Shield,
  "users": Gauge,
};

function GroupIcon({ name }: { name: string }) {
  const Icon = GROUP_ICONS[name] ?? Gauge;
  return <Icon size={16} />;
}

function ItemIcon({ name }: { name: string }) {
  const Icon = ITEM_ICONS[name] ?? Gauge;
  return <Icon size={14} />;
}

function isItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return href !== "/platform" && pathname.startsWith(href + "/");
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NAV_STORAGE_KEY = "fuelstation_nav_open";
const PIN_STORAGE_KEY = "fuelstation_sidebar_pinned";

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

interface SidebarProps {
  role: Role;
  fallbackStationId: string | null;
}

export default function Sidebar({ role, fallbackStationId }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasHydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const navGroups = useMemo(() => filterNavForRole(role), [role]);

  const currentStationId = searchParams.get("stationId") ?? fallbackStationId;

  // Persisted sidebar pin state
  const [isPinned, setIsPinned] = useLocalStorage(PIN_STORAGE_KEY, false);
  const isSidebarExpanded = role === "SUPER_ADMIN" || isPinned;

  // Persisted open group — single-accordion, one open at a time
  // The empty dep array is intentional: this is a mount-time default only.
  // useLocalStorage will take over from here and ignore subsequent changes.
  const defaultOpen = useMemo(() => {
    return navGroups[0]?.id ?? null;
  }, [navGroups]); // route-independent default avoids hydration mismatches during redirects

  const [openGroupId, setOpenGroupId] = useLocalStorage<string | null>(
    NAV_STORAGE_KEY,
    defaultOpen
  );


  // Open group is user-controlled. If persisted state belongs to another role,
  // fall back to the active route/default group.
  const openGroupStillAvailable = navGroups.some((group) => group.id === openGroupId);
  const effectiveOpenId =
    navGroups.length === 1
      ? navGroups[0]?.id
      : openGroupStillAvailable
        ? openGroupId
        : navGroups[0]?.id ?? null;

  function toggleGroup(id: string) {
    setOpenGroupId((prev) => (prev === id ? null : id));
  }

  function togglePin() {
    setIsPinned((prev) => !prev);
  }

  return (
    <aside className={`sidebar${isSidebarExpanded ? " expanded" : ""}`}>
      {/* Logo mark */}
      <div className="sidebar-logo" role="img" aria-label="FuelStation OS logo">
        <Image
          src="/axionera-sidebar-icon.png"
          alt=""
          width={36}
          height={36}
          priority
          aria-hidden="true"
        />
      </div>

      {/* Nav menu */}
      <ul className="nav-menu" role="navigation" aria-label="Main navigation">
        {navGroups.map((group: NavGroup) => {
          const isExpanded = effectiveOpenId === group.id;
          return (
            <li key={group.id} className={`nav-group${isExpanded ? " expanded" : ""}`}>
              <div
                className="nav-group-header"
                onClick={() => toggleGroup(group.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => e.key === "Enter" && toggleGroup(group.id)}
              >
                <span className="nav-group-icon">
                  <GroupIcon name={group.icon} />
                </span>
                <span className="nav-group-label">{group.label}</span>
                <ChevronDown
                  size={12}
                  className="nav-group-label"
                  style={{
                    marginLeft: "auto",
                    transform: isExpanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                />
              </div>
              <ul className="nav-group-items">
                {group.items.map((item) => {
                  const isActive = hasHydrated && isItemActive(pathname, item.href);
                  
                  // Append stationId if item is stationScoped
                  const hrefWithStation = withStationParam(item.href, currentStationId, item.stationScoped);

                  return (
                    <li key={item.href} className={`nav-item${isActive ? " active" : ""}`}>
                      <Link href={hrefWithStation} className="nav-item-link">
                        <span className="nav-item-icon">
                          <ItemIcon name={item.icon} />
                        </span>
                        <span className="nav-item-label">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      {/* Pin toggle */}
      <button
        className={`sidebar-pin${isSidebarExpanded ? " pinned" : ""}`}
        onClick={togglePin}
        title={isSidebarExpanded ? "Unpin sidebar" : "Pin sidebar open"}
        aria-label={isSidebarExpanded ? "Unpin sidebar" : "Pin sidebar open"}
        disabled={role === "SUPER_ADMIN"}
      >
        {isSidebarExpanded ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    </aside>
  );
}
