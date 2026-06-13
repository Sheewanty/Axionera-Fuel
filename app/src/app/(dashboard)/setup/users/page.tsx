import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { formatDisplayDate } from "@/lib/business-date";

export default async function UsersPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "AUDITOR"]);

  const memberships = await prisma.membership.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(session.user.membershipStationId === "" ? {} : { stationId: session.user.membershipStationId }),
    },
    include: {
      user: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  // Build a map of station IDs → station names for display
  const stationIds = [
    ...new Set(memberships.map((m) => m.stationId).filter((id) => id !== "")),
  ];

  const stations = stationIds.length > 0
    ? await prisma.station.findMany({
        where: { id: { in: stationIds }, tenantId: session.user.tenantId },
        select: { id: true, name: true },
      })
    : [];

  const stationNameMap = new Map(stations.map((s) => [s.id, s.name]));

  const roleOrder: Record<string, number> = {
    OWNER: 0,
    ADMIN: 1,
    STATION_MANAGER: 2,
    SUPERVISOR: 3,
    ATTENDANT: 4,
    ACCOUNTANT: 5,
    AUDITOR: 6,
  };

  const sorted = [...memberships].sort(
    (a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
  );

  const roleLabel: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    STATION_MANAGER: "Station Manager",
    SUPERVISOR: "Supervisor",
    ATTENDANT: "Attendant",
    ACCOUNTANT: "Accountant",
    AUDITOR: "Auditor",
  };

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Users & Roles"
        subtitle={`${memberships.length} membership${memberships.length !== 1 ? "s" : ""} across ${new Set(memberships.map((m) => m.userId)).size} user${new Set(memberships.map((m) => m.userId)).size !== 1 ? "s" : ""}`}
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Team Members</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Station Assignment</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--ax-muted)" }}>
                    No users configured yet.
                  </td>
                </tr>
              ) : (
                sorted.map((membership) => (
                  <tr key={membership.id}>
                    <td style={{ fontWeight: 600 }}>{membership.user.name}</td>
                    <td>{membership.user.email}</td>
                    <td>
                      <span className="status-badge" data-status={membership.role}>
                        {roleLabel[membership.role] ?? membership.role}
                      </span>
                    </td>
                    <td>
                      {membership.stationId === ""
                        ? <span style={{ color: "var(--ax-muted)" }}>All Stations</span>
                        : stationNameMap.get(membership.stationId) ?? membership.stationId}
                    </td>
                    <td>
                      <span className="status-badge" data-status={membership.user.status}>
                        {membership.user.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDisplayDate(membership.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
