import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { listExpenditures } from "@/lib/db/expenditure.service";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import ExpenditureClient from "./ExpenditureClient";

export default async function ExpenditurePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const targetStationId = await resolveOrRedirectStation(session, params.stationId, "/cash/expenditure");

  if (!targetStationId) {
    return (
      <div className="p-6">
        <PageTitle title="Expenditure" />
        <div className="mt-6 bg-white p-6 rounded shadow">
          <p>No stations available for this account.</p>
        </div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId });

  const station = await prisma.station.findFirst({
    where: { id: targetStationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return <div>Station not found</div>;
  }

  const dailySession = await prisma.dailySession.findFirst({
    where: { stationId: targetStationId, tenantId: session.user.tenantId, shift: "DAY" },
    orderBy: { businessDate: "desc" },
  });

  const expendituresDb = await listExpenditures(
    prisma,
    session.user.tenantId,
    targetStationId,
    dailySession?.id
  );

  const expenditures = expendituresDb.map((expense) => ({
    id: expense.id,
    dailySessionId: expense.dailySessionId,
    businessDate: expense.businessDate.toISOString().split("T")[0],
    voucherReference: expense.voucherReference,
    category: expense.category,
    amount: Number(expense.amount),
    paymentToBank: Number(expense.paymentToBank),
    paidBy: expense.paidBy,
    approvedBy: expense.approvedBy,
    receiptAttached: expense.receiptAttached,
    description: expense.description,
    createdAt: expense.createdAt.toISOString(),
  }));

  const formattedDate = dailySession?.businessDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageTitle
        eyebrow="Cash & Banking"
        title="Expenditure"
        subtitle={dailySession ? `${station.name} - ${formattedDate} - ${dailySession.shift} Shift` : station.name}
      />

      <ExpenditureClient
        station={{
          id: station.id,
          name: station.name,
        }}
        dailySession={
          dailySession
            ? {
                id: dailySession.id,
                businessDate: dailySession.businessDate.toISOString().split("T")[0],
                shift: dailySession.shift,
                status: dailySession.status,
              }
            : null
        }
        expenditures={expenditures}
      />
    </>
  );
}
