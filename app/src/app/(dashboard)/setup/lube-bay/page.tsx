import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireRole, requireStationScope } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import LubeBaySetupClient from "./LubeBaySetupClient";

export default async function LubeBaySetupPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/setup/lube-bay");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Setup" title="Lube Bay Setup" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No stations available for this account.
          </div>
        </div>
      </>
    );
  }

  requireStationScope(session, stationId);

  const [station, products, serviceTypes, momoOperators] = await Promise.all([
    prisma.station.findFirst({
      where: { id: stationId, tenantId: session.user.tenantId },
    }),
    prisma.product.findMany({
      where: {
        tenantId: session.user.tenantId,
        category: { in: ["LUBRICANT", "OTHER"] },
      },
      include: {
        priceHistory: {
          where: { tenantId: session.user.tenantId, stationId, effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lubeBayServiceType.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [{ stationId }, { stationId: null }],
      },
      orderBy: [{ name: "asc" }, { vehicleCategory: "asc" }],
    }),
    prisma.lubeBayMomoOperator.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [{ stationId }, { stationId: null }],
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Lube Bay Setup"
        subtitle={station ? `${station.name} - service types, products, and prices` : undefined}
      />

      {["OWNER", "ADMIN", "STATION_MANAGER"].includes(session.user.role) ? (
        <LubeBaySetupClient
          stationId={stationId}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            isActive: product.isActive,
            price: product.priceHistory[0] ? Number(product.priceHistory[0].pricePerLitre) : null,
          }))}
          serviceTypes={serviceTypes.map((service) => ({
            id: service.id,
            name: service.name,
            vehicleCategory: service.vehicleCategory,
            defaultLabourCharge: Number(service.defaultLabourCharge),
            isActive: service.isActive,
          }))}
          momoOperators={momoOperators.map((operator) => ({
            id: operator.id,
            name: operator.name,
            isActive: operator.isActive,
          }))}
        />
      ) : (
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            You have read-only access to lube bay setup.
          </div>
        </div>
      )}
    </>
  );
}
