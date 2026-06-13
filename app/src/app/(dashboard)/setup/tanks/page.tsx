import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { formatDisplayDate } from "@/lib/business-date";

export default async function TanksPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/setup/tanks");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Setup" title="Tanks" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No stations available for this account.
          </div>
        </div>
      </>
    );
  }
  requireStationScope(session, stationId);

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });

  const tanks = await prisma.tank.findMany({
    where: { stationId, tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    include: {
      product: true,
    },
  });

  const totalCapacity = tanks.reduce((sum, t) => sum + Number(t.capacityLitres), 0);

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Tanks"
        subtitle={station ? `${station.name} · ${tanks.length} tank${tanks.length !== 1 ? "s" : ""} · ${totalCapacity.toLocaleString()} L total capacity` : undefined}
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Tank Inventory</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tank Name</th>
                <th>Product</th>
                <th style={{ textAlign: "right" }}>Capacity (Litres)</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tanks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--ax-muted)" }}>
                    No tanks configured for this station yet.
                  </td>
                </tr>
              ) : (
                tanks.map((tank) => (
                  <tr key={tank.id}>
                    <td style={{ fontWeight: 600 }}>{tank.name}</td>
                    <td>{tank.product.name}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {Number(tank.capacityLitres).toLocaleString()}
                    </td>
                    <td>
                      <span className="status-badge" data-status={tank.status}>
                        {tank.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDisplayDate(tank.createdAt)}</td>
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
