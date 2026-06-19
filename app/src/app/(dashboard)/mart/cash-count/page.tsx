import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { formatCurrency } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { formatDisplayDate } from "@/lib/business-date";

export default async function MartCashCountPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/mart/cash-count");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Count" />
        <div className="mt-6 bg-white p-6 rounded shadow">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const records = await prisma.martSale.findMany({
    where: { tenantId: session.user.tenantId, stationId },
    include: { dailySession: true },
    orderBy: { businessDate: "desc" },
    take: 50,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle eyebrow="Mart Operations" title="Cash Count" subtitle="Closing physical mart cash counts from recorded mart sales summaries." />
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Business Date</th><th>Status</th><th>Opening Float</th><th>Cash Sales</th><th>Closing Physical Cash</th><th>Variance</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDisplayDate(record.businessDate)}</td>
                <td>{record.dailySession.status.replace(/_/g, " ")}</td>
                <td>{formatCurrency(Number(record.openingCash))}</td>
                <td>{formatCurrency(Number(record.cashSales))}</td>
                <td>{formatCurrency(Number(record.cashCount))}</td>
                <td><VarianceBadge value={Number(record.variance)} format={formatCurrency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
