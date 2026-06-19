import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { calcPhysicalCashToBank, formatCurrency } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";

export default async function CashVariancePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/cash/variance");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Variance" />
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
    include: {
      station: true,
      pumpReadings: true,
      expenditures: true,
      cashCollections: true,
      martSales: true,
    },
  });

  if (!dailySession) {
    return (
      <div className="p-6">
        <PageTitle title="Cash Variance" />
        <div className="mt-6 bg-white p-6 rounded shadow">Open today&apos;s session before reviewing cash variance.</div>
      </div>
    );
  }

  const pumpCash = dailySession.pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);
  const hqDirect = dailySession.pumpReadings.reduce((sum, r) => {
    return sum + Number(r.gocardAmount) + Number(r.couponAmount) + Number(r.ghqrAmount) + Number(r.creditorsAmount);
  }, 0);
  const netExpenditure = dailySession.expenditures.reduce((sum, r) => sum + Number(r.amount), 0);
  const expectedCash = calcPhysicalCashToBank(pumpCash, netExpenditure);
  const totalBanked = dailySession.cashCollections.reduce((sum, r) => sum + Number(r.amountToBank), 0);
  const bankingVariance = totalBanked - expectedCash;
  const martCashSales = dailySession.martSales.reduce((sum, r) => sum + Number(r.cashSales), 0);
  const martOpeningCash = dailySession.martSales.reduce((sum, r) => sum + Number(r.openingCash), 0);
  const martCashCount = dailySession.martSales.reduce((sum, r) => sum + Number(r.cashCount), 0);
  const martVariance = dailySession.martSales.reduce((sum, r) => sum + Number(r.variance), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Cash & Banking"
        title="Cash Variance"
        subtitle={`${dailySession.station.name} - ${formatDisplayDate(dailySession.businessDate)}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Expected Physical Cash</div>
          <div className="text-2xl font-semibold">{formatCurrency(expectedCash)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Total Banked</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalBanked)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Banking Variance</div>
          <VarianceBadge value={bankingVariance} format={formatCurrency} />
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Cash Build-Up</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><dt className="text-sm text-slate-500">Pump Physical Cash</dt><dd className="font-medium">{formatCurrency(pumpCash)}</dd></div>
          <div><dt className="text-sm text-slate-500">HQ-Direct Pump Sales</dt><dd className="font-medium">{formatCurrency(hqDirect)}</dd></div>
          <div><dt className="text-sm text-slate-500">Net Expenditure</dt><dd className="font-medium">{formatCurrency(netExpenditure)}</dd></div>
          <div><dt className="text-sm text-slate-500">Mart Opening Cash Float</dt><dd className="font-medium">{formatCurrency(martOpeningCash)}</dd></div>
          <div><dt className="text-sm text-slate-500">Mart Cash Sales</dt><dd className="font-medium">{formatCurrency(martCashSales)}</dd></div>
          <div><dt className="text-sm text-slate-500">Mart Closing Physical Cash</dt><dd className="font-medium">{formatCurrency(martCashCount)}</dd></div>
          <div><dt className="text-sm text-slate-500">Mart Cash Variance</dt><dd><VarianceBadge value={martVariance} format={formatCurrency} /></dd></div>
        </dl>
      </div>
    </div>
  );
}
