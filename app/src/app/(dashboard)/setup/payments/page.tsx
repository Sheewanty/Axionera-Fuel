import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireRole } from "@/lib/session";
import PaymentSetupClient from "./PaymentSetupClient";

export default async function PaymentSetupPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  const [stations, momoOperators] = await Promise.all([
    prisma.station.findMany({
      where: { tenantId: session.user.tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.lubeBayMomoOperator.findMany({
      where: { tenantId: session.user.tenantId },
      include: { station: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Setup"
        title="Payment Setup"
        subtitle="Shared payment-channel setup for forecourt, mart, lube bay, and debtor payments"
      />

      {["OWNER", "ADMIN", "STATION_MANAGER"].includes(session.user.role) ? (
        <PaymentSetupClient
          stations={stations.map((station) => ({
            id: station.id,
            name: station.name,
          }))}
          momoOperators={momoOperators.map((operator) => ({
            id: operator.id,
            name: operator.name,
            stationId: operator.stationId,
            stationName: operator.station?.name ?? null,
            isActive: operator.isActive,
          }))}
        />
      ) : (
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            You have read-only access to payment setup.
          </div>
        </div>
      )}
    </>
  );
}
