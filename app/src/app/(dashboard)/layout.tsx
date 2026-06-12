import Sidebar from "@/components/shell/Sidebar";
import Header from "@/components/shell/Header";
import { getRequiredSession } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { getAccessibleStations } from "@/lib/db/station.service";
import type { Role } from "@/lib/nav-config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real session — redirects to /login if unauthenticated (middleware also guards this)
  const session = await getRequiredSession();
  const { user } = session;

  let stations: { id: string; name: string }[] = [];
  let fallbackStationId: string | null = null;

  try {
    stations = await getAccessibleStations(user.tenantId, user.membershipStationId);
    if (user.activeStationId) {
      const active = stations.find((s) => s.id === user.activeStationId);
      if (active) fallbackStationId = active.id;
    } else if (stations.length > 0) {
      fallbackStationId = stations[0].id;
    }
  } catch {
    // DB not connected in dev — fall back to empty
  }

  // Build avatar initials from user name
  const avatarInitials = (user.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Sign-out Server Action — called by the sign-out button in the header
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="app-shell">
      <Sidebar role={user.role as Role} fallbackStationId={fallbackStationId} />
      <div className="main-content">
        <Header
          title="FuelStation OS"
          subtitle={/* tenant name */ "GOIL Ghana Ltd"}
          userName={user.name ?? user.email ?? "User"}
          userRole={user.role as Role}
          avatarInitials={avatarInitials}
          stations={stations}
          fallbackStationId={fallbackStationId}
          onSignOut={handleSignOut}
        />
        <main className="page-container custom-scroll">{children}</main>
      </div>
    </div>
  );
}
