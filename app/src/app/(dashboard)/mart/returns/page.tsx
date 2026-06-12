import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { formatCurrency } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";

export default async function MartReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/mart/returns");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Returns" />
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
      <PageTitle eyebrow="Mart Operations" title="Returns" subtitle="Returns are currently captured inside the daily mart sales summary." />
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Business Date</th><th>Status</th><th>Returns</th><th>Net Mart Sales</th><th>Remarks</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.businessDate.toISOString().split("T")[0]}</td>
                <td>{record.dailySession.status.replace(/_/g, " ")}</td>
                <td>{formatCurrency(Number(record.returns))}</td>
                <td>{formatCurrency(Number(record.netMartSales))}</td>
                <td>{record.remarks ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
