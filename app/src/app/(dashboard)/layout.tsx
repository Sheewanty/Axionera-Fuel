import Sidebar from "@/components/shell/Sidebar";
import Header from "@/components/shell/Header";
import { getRequiredSession } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { getAccessibleStations } from "@/lib/db/station.service";
import { prisma } from "@/lib/db/prisma";
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
  let tenantName = "FuelStation OS";
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  try {
    if (isSuperAdmin) {
      tenantName = "Axionera Global Limited";
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true },
      });
      tenantName = tenant?.name ?? tenantName;

      stations = await getAccessibleStations(user.tenantId, user.membershipStationId);
      if (user.activeStationId) {
        const active = stations.find((s) => s.id === user.activeStationId);
        if (active) fallbackStationId = active.id;
      } else if (stations.length > 0) {
        fallbackStationId = stations[0].id;
      }
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
          subtitle={tenantName}
          userName={user.name ?? user.email ?? "User"}
          userRole={user.role as Role}
          avatarInitials={avatarInitials}
          stations={stations}
          fallbackStationId={fallbackStationId}
          showStationSwitcher={!isSuperAdmin}
          onSignOut={handleSignOut}
        />
        <main className="page-container custom-scroll">{children}</main>
      </div>
    </div>
  );
}
