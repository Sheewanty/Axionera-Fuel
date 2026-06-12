import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import DailyCloseClient from "./DailyCloseClient";
import { calcPhysicalCashToBank } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";

export default async function DailyClosePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/daily-close");

  if (!targetStationId) {
    return (
      <div className="p-6">
        <PageTitle title="Daily Close" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No stations available for this account.</p>
        </div>
      </div>
    );
  }

  // Verify access (just write access for viewing)
  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      stationId: targetStationId,
      tenantId: session.user.tenantId,
    },
    orderBy: { businessDate: "desc" },
    include: {
      pumpReadings: true,
      tankDippings: true,
      cashCollections: true,
      productDischarges: true,
      expenditures: true,
      martSales: true,
    },
  });

  if (!station || !dailySession) {
    return (
      <div className="p-6">
        <PageTitle title="Daily Close" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No active station or daily session found.</p>
        </div>
      </div>
    );
  }

  // 1. Calculate Pump Totals
  const totalLitresSold = dailySession.pumpReadings.reduce((sum, r) => sum + Number(r.litresSold), 0);
  const totalPumpCash = dailySession.pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);
  const totalPumpExpected = dailySession.pumpReadings.reduce((sum, r) => sum + (Number(r.litresSold) * Number(r.pricePerLitre)), 0);
  const totalPumpVariance = dailySession.pumpReadings.reduce((sum, r) => sum + Number(r.variance), 0);

  // 2. Calculate Tank Totals
  const totalDischargeVariance = dailySession.productDischarges.reduce((sum, r) => sum + Number(r.dischargeVarianceLitres), 0);
  const totalStockVariance = dailySession.tankDippings.reduce((sum, r) => sum + Number(r.varianceLitres), 0);

  // 3. Calculate Cash Totals
  const totalNetExpenditure = dailySession.expenditures.reduce((sum, exp) => {
    return sum + (Number(exp.amount) - Number(exp.paymentToBank));
  }, 0);
  const expectedCash = calcPhysicalCashToBank(totalPumpCash, totalNetExpenditure);
  const totalBanked = dailySession.cashCollections.reduce((sum, c) => sum + Number(c.amountToBank), 0);
  const bankingVariance = totalBanked - expectedCash; // Positive = overbanked, Negative = short

  // 4. Verification Check
  const canClose = 
    dailySession.pumpReadings.length > 0 && 
    dailySession.tankDippings.length > 0 && 
    dailySession.cashCollections.length > 0;

  const missingRequirements = [];
  if (dailySession.pumpReadings.length === 0) missingRequirements.push("Pump Readings");
  if (dailySession.tankDippings.length === 0) missingRequirements.push("Tank Dipping");
  if (dailySession.cashCollections.length === 0) missingRequirements.push("Cash Entries");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DailyCloseClient
        station={station}
        dailySession={{
          id: dailySession.id,
          businessDate: dailySession.businessDate.toISOString().split("T")[0],
          shift: dailySession.shift,
          status: dailySession.status,
          supervisorNotes: dailySession.supervisorNotes,
        }}
        summary={{
          totalLitresSold,
          totalPumpExpected,
          totalPumpVariance,
          expectedCash,
          totalBanked,
          bankingVariance,
          totalDischargeVariance,
          totalStockVariance,
          missingRequirements,
          canClose,
        }}
        userRoles={session.user.role ? [session.user.role] : []}
      />
    </div>
  );
}
