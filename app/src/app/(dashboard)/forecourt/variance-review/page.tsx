import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { resolveOrRedirectStation } from "@/lib/station-utils";

function todayBusinessDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default async function VarianceReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/forecourt/variance-review");

  if (!stationId) {
    return (
      <div className="p-6">
        <PageTitle title="Variance Review" />
        <div className="mt-6 bg-white p-6 rounded shadow">No stations available for this account.</div>
      </div>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });
  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      businessDate: todayBusinessDate(),
      shift: "DAY",
    },
    include: {
      pumpReadings: { include: { nozzle: true, product: true }, orderBy: { createdAt: "asc" } },
      tankDippings: { include: { tank: true, product: true }, orderBy: { createdAt: "asc" } },
      productDischarges: { include: { tank: true, product: true }, orderBy: { createdAt: "asc" } },
      cashCollections: { orderBy: { createdAt: "asc" } },
      martSales: true,
    },
  });

  if (!station || !dailySession) {
    return (
      <div className="p-6">
        <PageTitle title="Variance Review" />
        <div className="mt-6 bg-white p-6 rounded shadow">Open today&apos;s session before reviewing variances.</div>
      </div>
    );
  }

  const pumpVariance = dailySession.pumpReadings.reduce((sum, r) => sum + Number(r.variance), 0);
  const tankVariance = dailySession.tankDippings.reduce((sum, r) => sum + Number(r.varianceLitres), 0);
  const dischargeVariance = dailySession.productDischarges.reduce((sum, r) => sum + Number(r.dischargeVarianceLitres), 0);
  const bankVariance = dailySession.cashCollections.reduce((sum, r) => sum + Number(r.variance), 0);
  const martVariance = dailySession.martSales.reduce((sum, r) => sum + Number(r.variance), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageTitle
        eyebrow="Forecourt Operations"
        title="Variance Review"
        subtitle={`${station.name} - ${dailySession.businessDate.toISOString().split("T")[0]} - ${dailySession.status.replace(/_/g, " ")}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Pump Sales</div>
          <VarianceBadge value={pumpVariance} format={formatCurrency} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Tank Stock</div>
          <VarianceBadge value={tankVariance} format={formatLitres} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Discharge</div>
          <VarianceBadge value={dischargeVariance} format={formatLitres} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Banking</div>
          <VarianceBadge value={bankVariance} format={formatCurrency} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-slate-500">Mart Cash</div>
          <VarianceBadge value={martVariance} format={formatCurrency} />
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">Pump Variances</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nozzle</th>
              <th>Product</th>
              <th>Expected</th>
              <th>Cash</th>
              <th>HQ Direct</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {dailySession.pumpReadings.map((r) => {
              const hq = Number(r.gocardAmount) + Number(r.couponAmount) + Number(r.ghqrAmount) + Number(r.creditorsAmount);
              return (
                <tr key={r.id}>
                  <td>{r.nozzle.name}</td>
                  <td>{r.product.name}</td>
                  <td>{formatCurrency(Number(r.amountExpected))}</td>
                  <td>{formatCurrency(Number(r.cashReceived))}</td>
                  <td>{formatCurrency(hq)}</td>
                  <td><VarianceBadge value={Number(r.variance)} format={formatCurrency} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b font-semibold">Tank and Discharge Variances</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tank</th>
              <th>Product</th>
              <th>Receipts</th>
              <th>Meter Sold</th>
              <th>Tank Variance</th>
            </tr>
          </thead>
          <tbody>
            {dailySession.tankDippings.map((r) => (
              <tr key={r.id}>
                <td>{r.tank.name}</td>
                <td>{r.product.name}</td>
                <td>{formatLitres(Number(r.receiptsLitres))}</td>
                <td>{formatLitres(Number(r.meterSoldLitres))}</td>
                <td><VarianceBadge value={Number(r.varianceLitres)} format={formatLitres} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
