import { Banknote, CreditCard, Fuel, WalletCards } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import { formatReportDate, resolveReportStation } from "@/lib/reports";
import { getRequiredSession, requireRole } from "@/lib/session";

type SearchParams = Promise<{ stationId?: string }>;

export default async function ProductSalesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const params = await searchParams;
  const station = await resolveReportStation(session, params.stationId, "/reports/product-sales");

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Reports" title="Product Sales" />
        <div className="dash-panel">
          <p style={{ color: "var(--ax-muted)" }}>
            No station is available for this account. Complete station setup before running this report.
          </p>
        </div>
      </>
    );
  }

  const readings = await prisma.pumpReading.findMany({
    where: {
      tenantId: session.user.tenantId,
      stationId: station.id,
      isClosingRecorded: true,
    },
    include: {
      product: { select: { name: true, category: true } },
      dailySession: { select: { businessDate: true, shift: true } },
    },
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 250,
  });

  const productRows = Array.from(
    readings.reduce((map, reading) => {
      const key = reading.productId;
      const existing = map.get(key) ?? {
        product: reading.product.name,
        category: reading.product.category,
        litres: 0,
        expectedRevenue: 0,
        cash: 0,
        hqDirect: 0,
        credit: 0,
        variance: 0,
      };

      existing.litres += Number(reading.litresSold);
      existing.expectedRevenue += Number(reading.amountExpected);
      existing.cash += Number(reading.cashReceived);
      existing.hqDirect +=
        Number(reading.gocardAmount) + Number(reading.couponAmount) + Number(reading.ghqrAmount);
      existing.credit += Number(reading.creditorsAmount);
      existing.variance += Number(reading.variance);
      map.set(key, existing);
      return map;
    }, new Map<string, { product: string; category: string; litres: number; expectedRevenue: number; cash: number; hqDirect: number; credit: number; variance: number }>())
  ).map(([, row]) => row);

  const totals = productRows.reduce(
    (acc, row) => {
      acc.litres += row.litres;
      acc.expectedRevenue += row.expectedRevenue;
      acc.cash += row.cash;
      acc.hqDirect += row.hqDirect;
      acc.credit += row.credit;
      acc.variance += row.variance;
      return acc;
    },
    { litres: 0, expectedRevenue: 0, cash: 0, hqDirect: 0, credit: 0, variance: 0 }
  );

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Product Sales"
        subtitle={`${station.name} - latest ${readings.length} closing readings`}
        actions={
          <a className="btn btn-outline" href={`/api/reports/export?type=product-sales&stationId=${station.id}`}>
            Export CSV
          </a>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard label="Total Litres" value={formatLitres(totals.litres)} icon={<Fuel size={16} />} />
        <KpiCard label="Expected Revenue" value={formatCurrency(totals.expectedRevenue)} icon={<Banknote size={16} />} />
        <KpiCard label="Cash Sales" value={formatCurrency(totals.cash)} icon={<WalletCards size={16} />} />
        <KpiCard label="HQ Direct Sales" value={formatCurrency(totals.hqDirect)} icon={<CreditCard size={16} />} />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Sales by Product</div>
            <div className="dash-panel-sub">Tenant and station scoped</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Litres</th>
                <th style={{ textAlign: "right" }}>Expected Revenue</th>
                <th style={{ textAlign: "right" }}>Cash</th>
                <th style={{ textAlign: "right" }}>HQ Direct</th>
                <th style={{ textAlign: "right" }}>Credit</th>
                <th style={{ textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {productRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ax-muted)", padding: 24 }}>
                    No product sales have been recorded for this station.
                  </td>
                </tr>
              ) : (
                productRows.map((row) => (
                  <tr key={row.product}>
                    <td style={{ fontWeight: 700 }}>{row.product}</td>
                    <td>{row.category}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(row.litres)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(row.expectedRevenue)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(row.cash)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(row.hqDirect)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(row.credit)}</td>
                    <td style={{ textAlign: "right" }}>
                      <VarianceBadge value={row.variance} format={(value) => formatCurrency(Math.abs(value))} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-title">Latest Closing Readings</div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Product</th>
                <th style={{ textAlign: "right" }}>Litres</th>
                <th style={{ textAlign: "right" }}>Expected</th>
                <th style={{ textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(0, 20).map((reading) => (
                <tr key={reading.id}>
                  <td>{formatReportDate(reading.dailySession.businessDate)}</td>
                  <td>{reading.dailySession.shift}</td>
                  <td>{reading.product.name}</td>
                  <td style={{ textAlign: "right" }}>{formatLitres(Number(reading.litresSold))}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(reading.amountExpected))}</td>
                  <td style={{ textAlign: "right" }}>
                    <VarianceBadge value={Number(reading.variance)} format={(value) => formatCurrency(Math.abs(value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
