import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";

export default async function StationsPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const stations = await prisma.station.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(session.user.membershipStationId === "" ? {} : { id: session.user.membershipStationId }),
    },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          pumps: true,
          tanks: true,
        },
      },
    },
  });

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Stations"
        subtitle={`${stations.length} station${stations.length !== 1 ? "s" : ""} configured`}
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">All Stations</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Station Name</th>
                <th>Code</th>
                <th>Location</th>
                <th>Pumps</th>
                <th>Tanks</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {stations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--ax-muted)" }}>
                    No stations configured yet.
                  </td>
                </tr>
              ) : (
                stations.map((station) => (
                  <tr key={station.id}>
                    <td style={{ fontWeight: 600 }}>{station.name}</td>
                    <td><code>{station.code}</code></td>
                    <td>{station.location ?? <span style={{ color: "var(--ax-muted)" }}>—</span>}</td>
                    <td>{station._count.pumps}</td>
                    <td>{station._count.tanks}</td>
                    <td>
                      <span className="status-badge" data-status={station.status}>
                        {station.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{station.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
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
