import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import TankDippingClient from "./TankDippingClient";

export default async function TankDippingPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/tank-dipping");

  if (!targetStationId) {
    return (
      <>
        <PageTitle eyebrow="Forecourt Operations" title="Tank Dipping" />
        <div className="dash-panel" style={{ padding: 24 }}>
          <div className="dash-panel-title">No Stations Configured</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Create at least one station, then add tanks before recording tank dipping.
          </p>
        </div>
      </>
    );
  }

  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found</div>;

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      stationId: targetStationId,
      tenantId: session.user.tenantId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  if (!dailySession) {
    return (
      <>
        <PageTitle eyebrow="Forecourt Operations" title="Tank Dipping" subtitle={station.name} />
        <div className="dash-panel" style={{ padding: 24 }}>
          <div className="dash-panel-title">No Open Daily Session</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Open today&apos;s daily session before recording tank dipping.
          </p>
        </div>
      </>
    );
  }

  const tanksDb = await prisma.tank.findMany({
    where: { stationId: targetStationId, tenantId: session.user.tenantId },
    include: { product: true },
    orderBy: { name: "asc" },
  });

  const tanks = tanksDb.map((t) => ({
    id: t.id,
    name: t.name,
    productId: t.product.id,
    productName: t.product.name,
    openingStock: 0,
    meterSold: 0,
  }));

  if (tanks.length === 0) {
    return (
      <>
        <PageTitle
          eyebrow="Forecourt Operations"
          title="Tank Dipping"
          subtitle={`${station.name} - ${formatDisplayDate(dailySession.businessDate)}`}
        />
        <div className="dash-panel" style={{ padding: 24 }}>
          <div className="dash-panel-title">No Tanks Configured</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Add station tanks under Setup before recording tank dipping.
          </p>
        </div>
      </>
    );
  }

  for (const tank of tanks) {
    const latestDipping = await prisma.tankDipping.findFirst({
      where: { tankId: tank.id, tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
    });
    tank.openingStock = latestDipping ? Number(latestDipping.closingStockLitres) : 0;

    const pumpReadings = await prisma.pumpReading.findMany({
      where: { dailySessionId: dailySession.id, productId: tank.productId, tenantId: session.user.tenantId },
      select: { litresSold: true },
    });
    tank.meterSold = pumpReadings.reduce((sum, r) => sum + Number(r.litresSold), 0);
  }

  const dippingsDb = await prisma.tankDipping.findMany({
    where: { dailySessionId: dailySession.id, tenantId: session.user.tenantId },
    include: { tank: true, product: true },
    orderBy: { createdAt: "desc" },
  });

  const dippings = dippingsDb.map((d) => ({
    id: d.id,
    tankId: d.tankId,
    tank: d.tank.name,
    productId: d.productId,
    product: d.product.name,
    openingStock: Number(d.openingStockLitres),
    receipts: Number(d.receiptsLitres),
    meterSold: Number(d.meterSoldLitres),
    closingStock: Number(d.closingStockLitres),
    varianceLitres: Number(d.varianceLitres),
    waterTest: d.waterTestStatus,
    closingDipCm: d.closingDipCm ? Number(d.closingDipCm) : null,
    remarks: d.remarks,
  }));

  const formattedDate = formatDisplayDate(dailySession.businessDate);

  return (
    <>
      <PageTitle
        eyebrow="Forecourt Operations"
        title="Tank Dipping"
        subtitle={`${station.name} - ${formattedDate}`}
      />

      <TankDippingClient
        stationId={targetStationId}
        dailySessionId={dailySession.id}
        businessDate={dailySession.businessDate.toISOString()}
        dippings={dippings}
        tanks={tanks}
      />
    </>
  );
}
