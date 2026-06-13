import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { formatCurrency } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";

export default async function MartSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/mart/summary");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Mart Summary" />
        <div className="mt-6 bg-white p-6 rounded shadow">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
    include: { station: true, martSales: true },
  });

  const martSale = dailySession?.martSales[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Mart Operations"
        title="Mart Summary"
        subtitle={dailySession ? `${dailySession.station.name} - ${formatDisplayDate(dailySession.businessDate)}` : "Open the daily session before reviewing mart sales."}
      />

      {!dailySession || !martSale ? (
        <div className="bg-white p-6 rounded shadow">
          No mart sales summary has been recorded for today&apos;s session.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded shadow"><div className="text-sm text-slate-500">Net Mart Sales</div><div className="text-2xl font-semibold">{formatCurrency(Number(martSale.netMartSales))}</div></div>
            <div className="bg-white p-4 rounded shadow"><div className="text-sm text-slate-500">Cash Sales</div><div className="text-2xl font-semibold">{formatCurrency(Number(martSale.cashSales))}</div></div>
            <div className="bg-white p-4 rounded shadow"><div className="text-sm text-slate-500">Cash Count</div><div className="text-2xl font-semibold">{formatCurrency(Number(martSale.cashCount))}</div></div>
            <div className="bg-white p-4 rounded shadow"><div className="text-sm text-slate-500">Cash Variance</div><VarianceBadge value={Number(martSale.variance)} format={formatCurrency} /></div>
          </div>

          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-lg font-semibold mb-4">Sales Channels</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><dt className="text-sm text-slate-500">Opening Cash</dt><dd className="font-medium">{formatCurrency(Number(martSale.openingCash))}</dd></div>
              <div><dt className="text-sm text-slate-500">POS Sales</dt><dd className="font-medium">{formatCurrency(Number(martSale.posSales))}</dd></div>
              <div><dt className="text-sm text-slate-500">Cash Sales</dt><dd className="font-medium">{formatCurrency(Number(martSale.cashSales))}</dd></div>
              <div><dt className="text-sm text-slate-500">Mobile Money</dt><dd className="font-medium">{formatCurrency(Number(martSale.mobileMoney))}</dd></div>
              <div><dt className="text-sm text-slate-500">Returns</dt><dd className="font-medium">{formatCurrency(Number(martSale.returns))}</dd></div>
              <div><dt className="text-sm text-slate-500">Remarks</dt><dd className="font-medium">{martSale.remarks ?? "-"}</dd></div>
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
