import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CashEntriesClient from "./CashEntriesClient";
import { currentBusinessDate } from "@/lib/business-date";
import { getPendingCashCollectionWindow } from "@/lib/db/cash-collection.service";

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

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Entries" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No active station found.</p>
        </div>
      </div>
    );
  }

  const pendingCashSessions = await getPendingCashCollectionWindow(session.user.tenantId, targetStationId, prisma);

  const cashCollections = await prisma.cashCollection.findMany({
    where: {
      tenantId: session.user.tenantId,
      stationId: targetStationId,
    },
    include: {
      dailySession: {
        select: {
          businessDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalCashReceived = pendingCashSessions.reduce((sum, pending) => sum + pending.totalPumpCashReceived, 0);
  const totalDebtorCashReceived = pendingCashSessions.reduce((sum, pending) => sum + pending.totalDebtorCashReceived, 0);
  const totalLubeBayCashSales = pendingCashSessions.reduce((sum, pending) => sum + pending.totalLubeBayCashSales, 0);
  const totalNetExpenditure = pendingCashSessions.reduce((sum, pending) => sum + pending.totalNetExpenditure, 0);
  const totalBanked = pendingCashSessions.reduce((sum, pending) => sum + pending.totalBanked, 0);
  const currentExpectedCash = pendingCashSessions.reduce((sum, pending) => sum + pending.remainingExpectedCash, 0);

  // Parse types for client component
  const parsedCollections = cashCollections.map(c => ({
    id: c.id,
    dailySessionId: c.dailySessionId,
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

  const pendingBusinessDates = pendingCashSessions.map((pending) => pending.businessDate);
  const pendingFromDate = pendingBusinessDates[0]?.toISOString().split("T")[0] ?? null;
  const pendingToDate = pendingBusinessDates[pendingBusinessDates.length - 1]?.toISOString().split("T")[0] ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageTitle title="Cash Entries" />
      <div className="mt-6">
        <CashEntriesClient
          station={station}
          collectionDate={currentBusinessDate().toISOString().split("T")[0]}
          pendingFromDate={pendingFromDate}
          pendingToDate={pendingToDate}
          cashCollections={parsedCollections}
          currentExpectedCash={currentExpectedCash}
          totalCashReceived={totalCashReceived}
          totalDebtorCashReceived={totalDebtorCashReceived}
          totalLubeBayCashSales={totalLubeBayCashSales}
          totalNetExpenditure={totalNetExpenditure}
          totalBanked={totalBanked}
        />
      </div>
    </div>
  );
}
