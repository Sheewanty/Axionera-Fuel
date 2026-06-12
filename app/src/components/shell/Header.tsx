"use client";

import { Search, LogOut, Store } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName: string;
  userRole: string;
  avatarInitials: string;
  stations: { id: string; name: string }[];
  fallbackStationId: string | null;
  /** Server Action for signing out. Called via form action to preserve Server Action semantics. */
  onSignOut?: () => Promise<void>;
}

export default function Header({
  title,
  subtitle,
  userName,
  userRole,
  avatarInitials,
  stations,
  fallbackStationId,
  onSignOut,
}: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentStationId = searchParams.get("stationId") ?? fallbackStationId;

  const handleStationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStationId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("stationId", newStationId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="app-header">
      {/* Left — Page title */}
      <div className="header-title">
        <h1>{title}</h1>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      {/* Center — Global search */}
      <div className="global-search">
        <Search size={13} className="global-search-icon" />
        <input
          type="text"
          placeholder="Search stations, days, invoices..."
          aria-label="Global search"
          id="global-search"
          autoComplete="off"
        />
      </div>

      {/* Right — Station switcher + user account + sign-out */}
      <div className="header-right">
        {/* Station switcher */}
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200">
          <Store size={14} className="text-gray-500" />
          {stations.length === 0 ? (
            <span className="text-sm text-gray-500">No stations</span>
          ) : stations.length === 1 ? (
            <span className="text-sm font-medium text-gray-700">{stations[0].name}</span>
          ) : (
            <select
              value={currentStationId || ""}
              onChange={handleStationChange}
              className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer outline-none appearance-none pr-4"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
            >
              <option value="" disabled>Select Station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* User account */}
        <div className="user-account">
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole}</div>
          </div>
          <div className="user-avatar" title={userName} aria-label={`Avatar for ${userName}`}>
            {avatarInitials}
          </div>
        </div>

        {/* Sign-out — form wraps Server Action so it works without JS */}
        {onSignOut && (
          <form action={onSignOut}>
            <button
              type="submit"
              className="signout-btn"
              id="btn-signout"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={13} strokeWidth={2} style={{ display: "inline", marginRight: 4 }} />
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
