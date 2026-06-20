import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { formatDisplayDate } from "@/lib/business-date";
import { TankInventoryEditor, TankSetupForm } from "../SetupForms";

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

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Tanks"
        subtitle={station ? `${station.name} - ${tanks.length} tank${tanks.length !== 1 ? "s" : ""} - ${totalCapacity.toLocaleString()} L total capacity` : undefined}
      />

      {["OWNER", "ADMIN"].includes(session.user.role) && (
        <TankSetupForm stationId={stationId} products={products} />
      )}

      <TankInventoryEditor
        stationId={stationId}
        products={products}
        tanks={tanks.map((tank) => ({
          id: tank.id,
          name: tank.name,
          productId: tank.productId,
          productName: tank.product.name,
          capacityLitres: Number(tank.capacityLitres),
          status: tank.status,
          createdAt: formatDisplayDate(tank.createdAt),
        }))}
        canEdit={["OWNER", "ADMIN"].includes(session.user.role)}
      />
    </>
  );
}
