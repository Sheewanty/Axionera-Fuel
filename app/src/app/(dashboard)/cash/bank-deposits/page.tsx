import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { formatCurrency } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { formatDisplayDate } from "@/lib/business-date";

export default async function BankDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/cash/bank-deposits");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Bank Deposits" />
        <div className="mt-6 bg-white p-6 rounded shadow">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });
  const deposits = await prisma.cashCollection.findMany({
    where: { tenantId: session.user.tenantId, stationId },
    include: { dailySession: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalBanked = deposits.reduce((sum, deposit) => sum + Number(deposit.amountToBank), 0);
  const totalVariance = deposits.reduce((sum, deposit) => sum + Number(deposit.variance), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Cash & Banking"
        title="Bank Deposits"
        subtitle={station ? `${station.name} - latest 50 deposit records` : "Latest deposit records"}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Total Banked</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalBanked)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Total Variance</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalVariance)}</div>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Business Date</th>
              <th>Amount To Bank</th>
              <th>Expected Cash</th>
              <th>Variance</th>
              <th>Collection Date</th>
              <th>Reference</th>
              <th>Bank Signature</th>
              <th>Supervisor</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((deposit) => (
              <tr key={deposit.id}>
                <td>{formatDisplayDate(deposit.businessDate)}</td>
                <td>{formatCurrency(Number(deposit.amountToBank))}</td>
                <td>{formatCurrency(Number(deposit.expectedCash))}</td>
                <td>{formatCurrency(Number(deposit.variance))}</td>
                <td>{formatDisplayDate(deposit.bankCollectionDate)}</td>
                <td>{deposit.bankCollectionReference ?? "-"}</td>
                <td>{deposit.bankSignatureName ?? "-"}</td>
                <td>{deposit.supervisorSignatureName ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
