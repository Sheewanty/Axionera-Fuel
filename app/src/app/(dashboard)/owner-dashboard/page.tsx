import { Banknote, Droplets, Fuel, Store } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireRole } from "@/lib/session";

type SearchParams = Promise<{ range?: string }>;

function startDate(days: number) {
  const date = new Date(`${currentBusinessDate()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date;
}

function endDate() {
  return new Date(`${currentBusinessDate()}T00:00:00.000Z`);
}

export default async function OwnerDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "ACCOUNTANT", "AUDITOR"]);

  const params = await searchParams;
  const days = params.range === "30d" ? 30 : 7;
  const from = startDate(days);
  const to = endDate();

  const [tenant, stations, dailySessions] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true },
    }),
    prisma.station.findMany({
      where: { tenantId: session.user.tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.dailySession.findMany({
      where: {
        tenantId: session.user.tenantId,
        businessDate: {
          gte: from,
          lte: to,
        },
      },
      include: {
        station: { select: { id: true, name: true } },
        pumpReadings: true,
        cashCollections: true,
        tankDippings: true,
        martSales: true,
        expenditures: true,
        creditorLedger: true,
      },
      orderBy: { businessDate: "asc" },
    }),
  ]);

  const tenantName = tenant?.name ?? "Company";

  if (stations.length === 0) {
    return (
      <>
        <PageTitle
          eyebrow="Owner Dashboard"
          title="Cross-Station Analytics"
          subtitle={`${tenantName} - no stations configured`}
        />
        <div className="dash-panel" style={{ padding: 28 }}>
          <div className="dash-panel-title">No Station Data Yet</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            This company does not have any active stations. Create stations under Setup before owner analytics can be calculated.
          </p>
        </div>
      </>
    );
  }

  const totals = dailySessions.reduce(
    (acc, day) => {
      const pumpCash = day.pumpReadings.reduce((sum, row) => sum + Number(row.cashReceived), 0);
      const debtorCashPayments = day.creditorLedger
        .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "CASH")
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const expenditure = day.expenditures.reduce((sum, row) => sum + Number(row.amount), 0);

      acc.litres += day.pumpReadings.reduce((sum, row) => sum + Number(row.litresSold), 0);
      acc.expectedRevenue += day.pumpReadings.reduce((sum, row) => sum + Number(row.amountExpected), 0);
      acc.cashBanked += day.cashCollections.reduce((sum, row) => sum + Number(row.amountToBank), 0);
      acc.expectedCash += pumpCash + debtorCashPayments - expenditure;
      acc.tankVariance += day.tankDippings.reduce((sum, row) => sum + Number(row.varianceLitres), 0);
      acc.martSales += day.martSales.reduce((sum, row) => sum + Number(row.netMartSales), 0);
      return acc;
    },
    {
      litres: 0,
      expectedRevenue: 0,
      cashBanked: 0,
      expectedCash: 0,
      tankVariance: 0,
      martSales: 0,
    }
  );

  const stationRows = stations.map((station) => {
    const stationDays = dailySessions.filter((day) => day.stationId === station.id);
    const pumpCash = stationDays.reduce((sum, day) => {
      const cash = day.pumpReadings.reduce((inner, row) => inner + Number(row.cashReceived), 0);
      const debtorCash = day.creditorLedger
        .filter((entry) => entry.type === "PAYMENT" && entry.paymentMethod === "CASH")
        .reduce((inner, entry) => inner + Number(entry.amount), 0);
      return sum + cash + debtorCash;
    }, 0);
    const expenditure = stationDays.reduce((sum, day) => sum + day.expenditures.reduce((inner, row) => inner + Number(row.amount), 0), 0);
    const expectedCash = pumpCash - expenditure;
    const cashBanked = stationDays.reduce((sum, day) => sum + day.cashCollections.reduce((inner, row) => inner + Number(row.amountToBank), 0), 0);

    return {
      id: station.id,
      name: station.name,
      litres: stationDays.reduce((sum, day) => sum + day.pumpReadings.reduce((inner, row) => inner + Number(row.litresSold), 0), 0),
      expectedRevenue: stationDays.reduce((sum, day) => sum + day.pumpReadings.reduce((inner, row) => inner + Number(row.amountExpected), 0), 0),
      cashBanked,
      bankingVariance: cashBanked - expectedCash,
      tankVariance: stationDays.reduce((sum, day) => sum + day.tankDippings.reduce((inner, row) => inner + Number(row.varianceLitres), 0), 0),
      martSales: stationDays.reduce((sum, day) => sum + day.martSales.reduce((inner, row) => inner + Number(row.netMartSales), 0), 0),
    };
  });

  const subtitle = `${tenantName} - ${stations.length} active station${stations.length !== 1 ? "s" : ""} - ${formatDisplayDate(from)} to ${formatDisplayDate(to)}`;
  const bankingVariance = totals.cashBanked - totals.expectedCash;

  return (
    <>
      <PageTitle
        eyebrow="Owner Dashboard"
        title="Cross-Station Analytics"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <a className={`btn ${days === 7 ? "btn-primary" : "btn-outline"} btn-sm`} href="/owner-dashboard?range=7d">7 Days</a>
            <a className={`btn ${days === 30 ? "btn-primary" : "btn-outline"} btn-sm`} href="/owner-dashboard?range=30d">30 Days</a>
          </div>
        }
      />

      {dailySessions.length === 0 && (
        <div className="dash-panel" style={{ padding: 20, marginBottom: 20 }}>
          <div className="dash-panel-title">No Operations Recorded Yet</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Stations exist for this company, but there are no daily sessions in the selected period. Open a day and enter operations to populate analytics.
          </p>
        </div>
      )}

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        <KpiCard label="Total Litres" value={formatLitres(totals.litres)} icon={<Fuel size={16} />} delta={`Across ${stations.length} station${stations.length !== 1 ? "s" : ""}`} />
        <KpiCard label="Expected Revenue" value={formatCurrency(totals.expectedRevenue)} icon={<Banknote size={16} />} />
        <KpiCard label="Cash Banked" value={formatCurrency(totals.cashBanked)} icon={<Banknote size={16} />} delta={`${formatCurrency(Math.abs(bankingVariance))} ${bankingVariance < 0 ? "short" : bankingVariance > 0 ? "over" : "variance"}`} deltaType={bankingVariance === 0 ? "positive" : "negative"} />
        <KpiCard label="Total Tank Variance" value={`${totals.tankVariance.toLocaleString()} L`} icon={<Droplets size={16} />} delta={totals.tankVariance === 0 ? "No variance" : "Review tank records"} deltaType={totals.tankVariance === 0 ? "positive" : "negative"} />
        <KpiCard label="Mart Net Sales" value={formatCurrency(totals.martSales)} icon={<Store size={16} />} />
        <KpiCard label="Net Cash Position" value={formatCurrency(totals.expectedCash)} icon={<Banknote size={16} />} delta="Cash expected after actual expenditure" deltaType="neutral" />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Station Performance</div>
            <div className="dash-panel-sub">Tenant-scoped data only</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Station</th>
                <th style={{ textAlign: "right" }}>Litres Sold</th>
                <th style={{ textAlign: "right" }}>Expected Revenue</th>
                <th style={{ textAlign: "right" }}>Cash Banked</th>
                <th style={{ textAlign: "right" }}>Banking Variance</th>
                <th style={{ textAlign: "right" }}>Tank Variance</th>
                <th style={{ textAlign: "right" }}>Mart Sales</th>
              </tr>
            </thead>
            <tbody>
              {stationRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 700 }}>{row.name}</td>
                  <td style={{ textAlign: "right" }}>{formatLitres(row.litres)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(row.expectedRevenue)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(row.cashBanked)}</td>
                  <td style={{ textAlign: "right" }}>
                    <VarianceBadge value={row.bankingVariance} format={(value) => formatCurrency(Math.abs(value))} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <VarianceBadge value={row.tankVariance} format={(value) => `${value.toLocaleString()} L`} />
                  </td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(row.martSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
