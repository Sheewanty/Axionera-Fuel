import { Droplets, Fuel, Gauge, Truck } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { formatLitres } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import { formatReportDate, resolveReportStation } from "@/lib/reports";
import { getRequiredSession, requireRole } from "@/lib/session";

type SearchParams = Promise<{ stationId?: string }>;

export default async function TankLossReportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const params = await searchParams;
  const station = await resolveReportStation(session, params.stationId, "/reports/tank-loss");

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Reports" title="Tank Loss" />
        <div className="dash-panel">
          <p style={{ color: "var(--ax-muted)" }}>
            No station is available for this account. Complete station setup before running this report.
          </p>
        </div>
      </>
    );
  }

  const [dippings, discharges] = await Promise.all([
    prisma.tankDipping.findMany({
      where: { tenantId: session.user.tenantId, stationId: station.id },
      include: {
        tank: { select: { name: true } },
        product: { select: { name: true } },
        dailySession: { select: { businessDate: true, shift: true } },
      },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.productDischarge.findMany({
      where: { tenantId: session.user.tenantId, stationId: station.id },
      include: {
        tank: { select: { name: true } },
        product: { select: { name: true } },
        dailySession: { select: { businessDate: true, shift: true } },
      },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const totals = dippings.reduce(
    (acc, row) => {
      acc.receipts += Number(row.receiptsLitres);
      acc.meterSold += Number(row.meterSoldLitres);
      acc.closingStock += Number(row.closingStockLitres);
      acc.tankVariance += Number(row.varianceLitres);
      return acc;
    },
    { receipts: 0, meterSold: 0, closingStock: 0, tankVariance: 0 }
  );

  const dischargeVariance = discharges.reduce(
    (sum, row) => sum + Number(row.dischargeVarianceLitres),
    0
  );

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Tank Loss"
        subtitle={`${station.name} - latest ${dippings.length} tank dipping records`}
        actions={
          <a className="btn btn-outline" href={`/api/reports/export?type=tank-loss&stationId=${station.id}`}>
            Export CSV
          </a>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard
          label="Tank Variance"
          value={formatLitres(totals.tankVariance)}
          icon={<Droplets size={16} />}
          delta={totals.tankVariance === 0 ? "No variance" : "Review tank records"}
          deltaType={totals.tankVariance === 0 ? "positive" : "negative"}
        />
        <KpiCard label="Meter Sold" value={formatLitres(totals.meterSold)} icon={<Gauge size={16} />} />
        <KpiCard label="Receipts" value={formatLitres(totals.receipts)} icon={<Truck size={16} />} />
        <KpiCard
          label="Discharge Variance"
          value={formatLitres(dischargeVariance)}
          icon={<Fuel size={16} />}
          delta={dischargeVariance === 0 ? "No discharge variance" : "Check discharge records"}
          deltaType={dischargeVariance === 0 ? "positive" : "negative"}
        />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Tank Dipping Variance</div>
            <div className="dash-panel-sub">Opening stock + receipts - meter sold - closing stock</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tank</th>
                <th>Product</th>
                <th style={{ textAlign: "right" }}>Opening</th>
                <th style={{ textAlign: "right" }}>Receipts</th>
                <th style={{ textAlign: "right" }}>Meter Sold</th>
                <th style={{ textAlign: "right" }}>Closing</th>
                <th style={{ textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {dippings.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ax-muted)", padding: 24 }}>
                    No tank dipping records have been recorded for this station.
                  </td>
                </tr>
              ) : (
                dippings.map((row) => (
                  <tr key={row.id}>
                    <td>{formatReportDate(row.dailySession.businessDate)}</td>
                    <td style={{ fontWeight: 700 }}>{row.tank.name}</td>
                    <td>{row.product.name}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.openingStockLitres))}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.receiptsLitres))}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.meterSoldLitres))}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.closingStockLitres))}</td>
                    <td style={{ textAlign: "right" }}>
                      <VarianceBadge value={Number(row.varianceLitres)} format={(value) => formatLitres(value)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-title">Product Discharge Check</div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tank</th>
                <th>Product</th>
                <th>Invoice</th>
                <th>Vehicle</th>
                <th style={{ textAlign: "right" }}>Discharged</th>
                <th style={{ textAlign: "right" }}>Adjustment / Top-up</th>
                <th style={{ textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {discharges.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ax-muted)", padding: 24 }}>
                    No product discharge records have been recorded for this station.
                  </td>
                </tr>
              ) : (
                discharges.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>{formatReportDate(row.dailySession.businessDate)}</td>
                    <td style={{ fontWeight: 700 }}>{row.tank.name}</td>
                    <td>{row.product.name}</td>
                    <td>{row.invoiceNumber}</td>
                    <td>{row.vehicleRegistrationNumber ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.productDischargedLitres))}</td>
                    <td style={{ textAlign: "right" }}>{formatLitres(Number(row.topUpLitres))}</td>
                    <td style={{ textAlign: "right" }}>
                      <VarianceBadge value={Number(row.dischargeVarianceLitres)} format={(value) => formatLitres(value)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
