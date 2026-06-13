import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate } from "@/lib/business-date";
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
    return <div>Error: No stations available for this account.</div>;
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
    return <div>No active session for this station</div>;
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
    tank: d.tank.name,
    product: d.product.name,
    openingStock: Number(d.openingStockLitres),
    receipts: Number(d.receiptsLitres),
    meterSold: Number(d.meterSoldLitres),
    closingStock: Number(d.closingStockLitres),
    varianceLitres: Number(d.varianceLitres),
    waterTest: d.waterTestStatus,
    closingDipCm: d.closingDipCm ? Number(d.closingDipCm) : null,
  }));

  const formattedDate = dailySession.businessDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageTitle
        eyebrow="Forecourt Operations"
        title="Tank Dipping"
        subtitle={`${station.name} · ${formattedDate}`}
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
