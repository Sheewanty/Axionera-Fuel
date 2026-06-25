import PageTitle from "@/components/ui/PageTitle";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import StockAdjustmentsClient from "./StockAdjustmentsClient";

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/stock-adjustments");

  if (!targetStationId) {
    return (
      <>
        <PageTitle eyebrow="Forecourt Operations" title="Stock Adjustments" />
        <div className="dash-panel" style={{ padding: 24 }}>
          <div className="dash-panel-title">No Stations Configured</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Create at least one station before recording stock adjustments.
          </p>
        </div>
      </>
    );
  }

  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Forecourt Operations" title="Stock Adjustments" />
        <div className="dash-panel" style={{ padding: 24 }}>Station not found.</div>
      </>
    );
  }

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId: targetStationId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  if (!dailySession) {
    return (
      <>
        <PageTitle eyebrow="Forecourt Operations" title="Stock Adjustments" subtitle={station.name} />
        <div className="dash-panel" style={{ padding: 24 }}>
          <div className="dash-panel-title">No Open Daily Session</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Open today&apos;s daily session before recording NPA draw-offs or other stock adjustments.
          </p>
        </div>
      </>
    );
  }

  const [tanksDb, adjustmentsDb] = await Promise.all([
    prisma.tank.findMany({
      where: { tenantId: session.user.tenantId, stationId: targetStationId, status: "ACTIVE" },
      include: { product: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockAdjustment.findMany({
      where: { tenantId: session.user.tenantId, stationId: targetStationId, dailySessionId: dailySession.id },
      include: { tank: true, product: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tanks = tanksDb.map((tank) => ({
    id: tank.id,
    name: tank.name,
    productId: tank.productId,
    productName: tank.product.name,
  }));

  const adjustments = adjustmentsDb.map((row) => ({
    id: row.id,
    tank: row.tank.name,
    product: row.product.name,
    adjustmentType: row.adjustmentType,
    direction: row.direction,
    litres: Number(row.litres),
    authorityReason: row.authorityReason,
    reference: row.reference,
    recordedByName: row.recordedByName,
    approvedByName: row.approvedByName,
    approvalStatus: row.approvalStatus,
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <>
      <PageTitle
        eyebrow="Forecourt Operations"
        title="Stock Adjustments"
        subtitle={`${station.name} - ${formatDisplayDate(dailySession.businessDate)}`}
      />

      <StockAdjustmentsClient
        stationId={targetStationId}
        dailySessionId={dailySession.id}
        businessDate={dailySession.businessDate.toISOString()}
        sessionStatus={dailySession.status}
        tanks={tanks}
        adjustments={adjustments}
      />
    </>
  );
}
