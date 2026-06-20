import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { PumpNozzleInventoryEditor, PumpNozzleSetupForms } from "../SetupForms";

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
            No stations available yet. Create a station before adding pumps and nozzles.
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

  const totalNozzles = pumps.reduce((sum, pump) => sum + pump.nozzles.length, 0);

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Pumps & Nozzles"
        subtitle={
          station
            ? `${station.name} - ${pumps.length} pump${pumps.length !== 1 ? "s" : ""}, ${totalNozzles} nozzle${totalNozzles !== 1 ? "s" : ""}`
            : undefined
        }
      />

      {["OWNER", "ADMIN"].includes(session.user.role) && (
        <PumpNozzleSetupForms
          stationId={stationId}
          products={products}
          pumps={pumps.map((pump) => ({ id: pump.id, name: pump.name }))}
        />
      )}

      <PumpNozzleInventoryEditor
        stationId={stationId}
        products={products}
        pumps={pumps.map((pump) => ({
          id: pump.id,
          name: pump.name,
          status: pump.status,
          nozzles: pump.nozzles.map((nozzle) => ({
            id: nozzle.id,
            name: nozzle.name,
            pumpId: pump.id,
            productId: nozzle.productId,
            productName: nozzle.product.name,
            meterCode: nozzle.meterCode,
            status: nozzle.status,
          })),
        }))}
        canEdit={["OWNER", "ADMIN"].includes(session.user.role)}
      />
    </>
  );
}
