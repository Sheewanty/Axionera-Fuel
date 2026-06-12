import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import PumpReadingsClient from "./PumpReadingsClient";

export default async function PumpReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/pump-readings");

  if (!targetStationId) {
    return <div>Error: No stations available for this account.</div>;
  }

  // Verify access
  await requireWriteAccess(session, { targetStationId });

  // 1. Fetch Station & Daily Session
  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });
  if (!station) return <div>Station not found</div>;

  // Assuming DAY shift for the demo
  const dailySession = await prisma.dailySession.findFirst({
    where: { stationId: targetStationId, tenantId: session.user.tenantId, shift: "DAY" },
    orderBy: { businessDate: "desc" },
  });

  if (!dailySession) {
    return <div>No active session for this station</div>;
  }

  // 2. Fetch all Nozzles (with Pump and Product)
  const nozzlesDb = await prisma.nozzle.findMany({
    where: { stationId: targetStationId, tenantId: session.user.tenantId },
    include: { 
      pump: true, 
      product: {
        include: {
          priceHistory: {
            where: { stationId: targetStationId },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          }
        }
      } 
    },
    orderBy: [{ pump: { name: "asc" } }, { name: "asc" }],
  });

  const nozzles = nozzlesDb.map((n) => ({
    id: n.id,
    name: n.name,
    pumpId: n.pump.id,
    pumpName: n.pump.name,
    productId: n.product.id,
    productName: n.product.name,
    pricePerLitre: n.product.priceHistory.length > 0 
      ? Number(n.product.priceHistory[0].pricePerLitre) 
      : 0,
    previousMeter: 0,
  }));

  // Fetch the latest reading for each nozzle to determine previousMeter
  for (const nozzle of nozzles) {
    const latestReading = await prisma.pumpReading.findFirst({
      where: { nozzleId: nozzle.id, tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
    });
    nozzle.previousMeter = latestReading ? Number(latestReading.currentLitre) : 0;
  }

  // 3. Fetch existing Readings for this session
  const readingsDb = await prisma.pumpReading.findMany({
    where: { dailySessionId: dailySession.id, tenantId: session.user.tenantId },
    include: { nozzle: { include: { pump: true } }, product: true },
    orderBy: { createdAt: "desc" },
  });

  const readings = readingsDb.map((r) => ({
    id: r.id,
    pump: r.nozzle.pump.name,
    nozzle: r.nozzle.name,
    product: r.product.name,
    attendant: "Attendant", // We can join user if attendantId exists
    previousMeter: Number(r.previousLitre),
    currentMeter: Number(r.currentLitre),
    litresSold: Number(r.litresSold),
    pricePerLitre: Number(r.pricePerLitre),
    amountExpected: Number(r.amountExpected),
    cashReceived: Number(r.cashReceived),
    gocardAmount: Number(r.gocardAmount),
    couponAmount: Number(r.couponAmount),
    ghqrAmount: Number(r.ghqrAmount),
    creditorsAmount: Number(r.creditorsAmount),
    variance: Number(r.variance),
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
        title="Pump Readings"
        subtitle={`${station.name} · ${formattedDate} · ${dailySession.shift} Shift`}
      />

      <PumpReadingsClient
        stationId={targetStationId}
        dailySessionId={dailySession.id}
        businessDate={dailySession.businessDate.toISOString()}
        readings={readings}
        nozzles={nozzles}
      />
    </>
  );
}
