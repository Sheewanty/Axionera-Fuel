import { Banknote, CalendarCheck, Landmark, Scale } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import PageTitle from "@/components/ui/PageTitle";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { formatCurrency } from "@/lib/calculations";
import { prisma } from "@/lib/db/prisma";
import { formatReportDate, resolveReportStation } from "@/lib/reports";
import { getRequiredSession, requireRole } from "@/lib/session";

type SearchParams = Promise<{ stationId?: string }>;

export default async function BankingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const params = await searchParams;
  const station = await resolveReportStation(session, params.stationId, "/reports/banking");

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Reports" title="Banking" />
        <div className="dash-panel">
          <p style={{ color: "var(--ax-muted)" }}>
            No station is available for this account. Complete station setup before running this report.
          </p>
        </div>
      </>
    );
  }

  const collections = await prisma.cashCollection.findMany({
    where: { tenantId: session.user.tenantId, stationId: station.id },
    include: {
      dailySession: { select: { businessDate: true, shift: true, status: true } },
    },
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 250,
  });

  const totals = collections.reduce(
    (acc, row) => {
      acc.expected += Number(row.expectedCash);
      acc.banked += Number(row.amountToBank);
      acc.variance += Number(row.variance);
      return acc;
    },
    { expected: 0, banked: 0, variance: 0 }
  );

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Banking"
        subtitle={`${station.name} - latest ${collections.length} cash collection records`}
        actions={
          <a className="btn btn-outline" href={`/api/reports/export?type=banking&stationId=${station.id}`}>
            Export CSV
          </a>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard label="Expected Cash" value={formatCurrency(totals.expected)} icon={<Banknote size={16} />} />
        <KpiCard label="Cash Banked" value={formatCurrency(totals.banked)} icon={<Landmark size={16} />} />
        <KpiCard
          label="Banking Variance"
          value={formatCurrency(totals.variance)}
          icon={<Scale size={16} />}
          delta={totals.variance === 0 ? "Fully reconciled" : "Review collection records"}
          deltaType={totals.variance === 0 ? "positive" : "negative"}
        />
        <KpiCard label="Collections" value={String(collections.length)} icon={<CalendarCheck size={16} />} />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Cash Collection Register</div>
            <div className="dash-panel-sub">Business date and bank collection date are tracked separately</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Date</th>
                <th>Shift</th>
                <th>Status</th>
                <th>Bank Date</th>
                <th>Reference</th>
                <th style={{ textAlign: "right" }}>Expected Cash</th>
                <th style={{ textAlign: "right" }}>Amount Banked</th>
                <th style={{ textAlign: "right" }}>Variance</th>
                <th>Bank Signature</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--ax-muted)", padding: 24 }}>
                    No banking records have been recorded for this station.
                  </td>
                </tr>
              ) : (
                collections.map((row) => (
                  <tr key={row.id}>
                    <td>{formatReportDate(row.dailySession.businessDate)}</td>
                    <td>{row.dailySession.shift}</td>
                    <td>{row.dailySession.status}</td>
                    <td>{row.bankCollectionDate ? formatReportDate(row.bankCollectionDate) : "-"}</td>
                    <td>{row.bankCollectionReference ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(Number(row.expectedCash))}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(Number(row.amountToBank))}</td>
                    <td style={{ textAlign: "right" }}>
                      <VarianceBadge value={Number(row.variance)} format={(value) => formatCurrency(Math.abs(value))} />
                    </td>
                    <td>{row.bankSignatureName ?? "-"}</td>
                    <td>{row.supervisorSignatureName ?? "-"}</td>
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
