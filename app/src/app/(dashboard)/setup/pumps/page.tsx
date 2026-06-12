import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";

export default async function PumpsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/setup/pumps");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Setup" title="Pumps & Nozzles" />
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

  const pumps = await prisma.pump.findMany({
    where: { stationId, tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    include: {
      nozzles: {
        orderBy: { name: "asc" },
        include: {
          product: true,
        },
      },
    },
  });

  const totalNozzles = pumps.reduce((sum, p) => sum + p.nozzles.length, 0);

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Pumps & Nozzles"
        subtitle={station ? `${station.name} · ${pumps.length} pump${pumps.length !== 1 ? "s" : ""}, ${totalNozzles} nozzle${totalNozzles !== 1 ? "s" : ""}` : undefined}
      />

      {pumps.length === 0 ? (
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No pumps configured for this station yet.
          </div>
        </div>
      ) : (
        pumps.map((pump) => (
          <div key={pump.id} className="dash-panel" style={{ marginBottom: "1rem" }}>
            <div className="dash-panel-head">
              <div>
                <div className="dash-panel-title">{pump.name}</div>
              </div>
              <span className="status-badge" data-status={pump.status}>
                {pump.status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
            </div>
            {pump.nozzles.length === 0 ? (
              <div style={{ padding: "1rem 1.25rem", color: "var(--ax-muted)", fontSize: "0.875rem" }}>
                No nozzles assigned to this pump.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nozzle</th>
                      <th>Product</th>
                      <th>Meter Code</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pump.nozzles.map((nozzle) => (
                      <tr key={nozzle.id}>
                        <td style={{ fontWeight: 600 }}>{nozzle.name}</td>
                        <td>{nozzle.product.name}</td>
                        <td>{nozzle.meterCode ?? <span style={{ color: "var(--ax-muted)" }}>—</span>}</td>
                        <td>
                          <span className="status-badge" data-status={nozzle.status}>
                            {nozzle.status === "ACTIVE" ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
