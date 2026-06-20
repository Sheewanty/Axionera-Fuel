import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CashEntriesClient from "./CashEntriesClient";
import { calcPhysicalCashToBank } from "@/lib/calculations";
import { currentBusinessDate } from "@/lib/business-date";

export default async function CashEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/cash-entries");

  if (!targetStationId) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Entries" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No stations available for this account.</p>
        </div>
      </div>
    );
  }

  // Verify access
  await requireWriteAccess(session, { targetStationId });

  // 1. Fetch Station & Daily Session
  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      stationId: targetStationId,
      tenantId: session.user.tenantId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
      status: { in: ["OPEN", "REOPENED"] },
    },
  });

  if (!station || !dailySession) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Entries" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No active station or open daily session found. Please open a session first.</p>
        </div>
      </div>
    );
  }

  // 2. Fetch existing Cash Collections
  const cashCollections = await prisma.cashCollection.findMany({
    where: {
      tenantId: session.user.tenantId,
      dailySessionId: dailySession.id,
    },
    orderBy: { createdAt: "asc" },
  });

  // 3. Compute expected cash for the UI
  const pumpReadings = await prisma.pumpReading.findMany({
    where: {
      tenantId: session.user.tenantId,
      dailySessionId: dailySession.id,
    },
    select: { cashReceived: true },
  });
  const totalCashReceived = pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);

  const debtorPayments = await prisma.creditorLedgerEntry.findMany({
    where: {
      tenantId: session.user.tenantId,
      dailySessionId: dailySession.id,
      type: "PAYMENT",
      paymentMethod: { in: ["CASH", "MOMO"] },
    },
    select: { amount: true },
  });
  const totalDebtorCashReceived = debtorPayments.reduce((sum, entry) => sum + Number(entry.amount), 0);

  const expenditures = await prisma.expenditure.findMany({
    where: {
      tenantId: session.user.tenantId,
      dailySessionId: dailySession.id,
    },
    select: { amount: true },
  });
  const totalNetExpenditure = expenditures.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const expectedCash = calcPhysicalCashToBank(totalCashReceived + totalDebtorCashReceived, totalNetExpenditure);
  
  const totalBanked = cashCollections.reduce((sum, c) => sum + Number(c.amountToBank), 0);
  const currentExpectedCash = expectedCash - totalBanked;

  // Parse types for client component
  const parsedCollections = cashCollections.map(c => ({
    id: c.id,
    businessDate: c.businessDate.toISOString().split("T")[0],
    amountToBank: Number(c.amountToBank),
    bankCollectionDate: c.bankCollectionDate ? c.bankCollectionDate.toISOString().split("T")[0] : null,
    bankCollectionReference: c.bankCollectionReference,
    expectedCash: Number(c.expectedCash),
    variance: Number(c.variance),
    bankSignatureName: c.bankSignatureName,
    supervisorSignatureName: c.supervisorSignatureName,
    remarks: c.remarks,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageTitle title="Cash Entries" />
      <div className="mt-6">
        <CashEntriesClient
          station={station}
          dailySession={{
            ...dailySession,
            businessDate: dailySession.businessDate.toISOString().split("T")[0],
          }}
          cashCollections={parsedCollections}
          currentExpectedCash={currentExpectedCash}
          totalCashReceived={totalCashReceived}
          totalDebtorCashReceived={totalDebtorCashReceived}
          totalNetExpenditure={totalNetExpenditure}
          totalBanked={totalBanked}
        />
      </div>
    </div>
  );
}
