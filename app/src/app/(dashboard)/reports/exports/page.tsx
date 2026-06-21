import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import { RELEASE_LABEL, resolveReportStation } from "@/lib/reports";
import { getRequiredSession, requireRole } from "@/lib/session";

type SearchParams = Promise<{ stationId?: string }>;

const EXPORTS = [
  {
    title: "Product Sales",
    description: "Pump reading sales by product, including cash, direct-to-HQ channels, credit, and variance.",
    type: "product-sales",
  },
  {
    title: "Tank Loss",
    description: "Tank dipping variance and product discharge checks for stock loss review.",
    type: "tank-loss",
  },
  {
    title: "Banking",
    description: "Cash collection register with business date, bank collection date, expected cash, and variance.",
    type: "banking",
  },
];

export default async function ReportExportsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const params = await searchParams;
  const station = await resolveReportStation(session, params.stationId, "/reports/exports");

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Reports" title="Exports" subtitle={RELEASE_LABEL} />
        <div className="dash-panel">
          <p style={{ color: "var(--ax-muted)" }}>
            No station is available for this account. Complete station setup before exporting reports.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Exports"
        subtitle={`${station.name} - ${RELEASE_LABEL}`}
      />

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Station Report Exports</div>
            <div className="dash-panel-sub">
              CSV files are scoped to the selected tenant and station.
            </div>
          </div>
          <ShieldCheck size={22} color="var(--ax-success)" />
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {EXPORTS.map((item) => (
            <div
              key={item.type}
              className="table-wrapper"
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto",
                alignItems: "center",
                gap: 16,
                padding: 16,
              }}
            >
              <div className="kpi-icon" style={{ position: "static" }}>
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: "var(--ax-navy)" }}>{item.title}</div>
                <div style={{ color: "var(--ax-muted)", marginTop: 4 }}>{item.description}</div>
              </div>
              <a
                className="btn btn-primary"
                href={`/api/reports/export?type=${item.type}&stationId=${station.id}`}
              >
                <Download size={16} />
                Export CSV
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
