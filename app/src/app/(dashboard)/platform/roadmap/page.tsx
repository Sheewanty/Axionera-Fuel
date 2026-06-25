import {
  Bell,
  CheckCircle2,
  CircleDashed,
  Clock3,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileText,
  Mail,
  MapPinned,
  MonitorSmartphone,
  RadioTower,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Truck,
  Wrench,
} from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireSuperAdmin } from "@/lib/session";

type RoadmapStatus = "DONE" | "IN_PROGRESS" | "PLANNED";

interface RoadmapItem {
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  status: RoadmapStatus;
  phase: string;
  nextSprint?: boolean;
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    title: "Multi-Tenant Auth, Roles, and Setup",
    description: "Tenant/company setup, stations, products, prices, tanks, pumps, nozzles, users, roles, and super-admin tenant controls.",
    icon: ShieldCheck,
    status: "DONE",
    phase: "V09.06",
  },
  {
    title: "Forecourt Daily Operations",
    description: "Opening/closing pump readings, tank dipping, product discharge, cash collection, expenditure, mart summary, and daily close lifecycle.",
    icon: CheckCircle2,
    status: "DONE",
    phase: "V09.06",
  },
  {
    title: "Lube Bay Base Workflow",
    description: "Service types, products, multi-line lube bay sales, payment modes, technician capture, and station-scoped setup.",
    icon: Wrench,
    status: "DONE",
    phase: "V09.06",
  },
  {
    title: "Debtors and Cash Controls",
    description: "Controlled debtor setup, credit sales/payments, debtor cash impact in bankable cash, and duplicate cash collection safeguards.",
    icon: CreditCard,
    status: "DONE",
    phase: "V09.06",
  },
  {
    title: "PDF/PPTX Reporting Engine",
    description: "Report generation, report library, tenant/station-scoped downloads, product sales, tank dip, tank loss, banking, expense, debtor, lube bay, and technician reports.",
    icon: FileText,
    status: "DONE",
    phase: "V09.07",
  },
  {
    title: "Production Baseline",
    description: "DigitalOcean Docker deployment, Caddy HTTPS, fuelstationos.com domain, health endpoint, and manual deployment path.",
    icon: CheckCircle2,
    status: "DONE",
    phase: "V09.06",
  },
  {
    title: "Excel Import and Backup/Restore",
    description: "Template validation and import UI exist; remaining work is import history, richer row-level validation, restore controls, and production-safe backup policy.",
    icon: DatabaseBackup,
    status: "IN_PROGRESS",
    phase: "Next Sprint",
    nextSprint: true,
  },
  {
    title: "CI/CD Production Deploy",
    description: "Workflow exists but GitHub environment secrets and deployment reliability still need final cleanup before routine production pushes.",
    icon: CircleDashed,
    status: "IN_PROGRESS",
    phase: "V09.07",
  },
  {
    title: "Report Scheduling and Email Delivery",
    description: "Generated reports are available in-app; scheduled PDF/PPTX delivery by email or SMS remains to be implemented.",
    icon: Mail,
    status: "PLANNED",
    phase: "V09.08",
  },
  {
    title: "Variance Explanation and Alert Escalation",
    description: "Variance reports exist; remaining work is explanation modals, variance thresholds, notification rules, and escalation workflow.",
    icon: Bell,
    status: "PLANNED",
    phase: "Next Sprint",
    nextSprint: true,
  },
  {
    title: "AI Operational Insights",
    description: "AI insight shell exists; remaining work is deterministic anomaly detectors for leakage, theft, calibration, delivery loss, and attendant exceptions.",
    icon: MonitorSmartphone,
    status: "PLANNED",
    phase: "V09.08",
  },
  {
    title: "Mobile App for Owners and Managers",
    description: "Mobile dashboards, push notifications for variances, and approval workflows.",
    icon: Smartphone,
    status: "PLANNED",
    phase: "Next Sprint Discovery",
    nextSprint: true,
  },
  {
    title: "Electronic Tank Probe Integration",
    description: "ATG integration for real-time tank level monitoring and reduced manual dipping.",
    icon: RadioTower,
    status: "PLANNED",
    phase: "Q3 2026",
  },
  {
    title: "POS Integration",
    description: "Automatic mart and card/cash/momo sales reconciliation from POS terminals.",
    icon: CreditCard,
    status: "PLANNED",
    phase: "Q4 2026",
  },
  {
    title: "Coupon Barcode Scanning",
    description: "Barcode validation and redemption tracking for coupons and HQ settlement.",
    icon: ScanBarcode,
    status: "PLANNED",
    phase: "Q4 2026",
  },
  {
    title: "Real-Time Fuel Monitoring",
    description: "Live dashboards for tank levels, flow rates, and consumption alerts.",
    icon: MonitorSmartphone,
    status: "PLANNED",
    phase: "Q4 2026",
  },
  {
    title: "NPA Compliance Reports",
    description: "Pre-formatted reports aligned with Ghana petroleum compliance needs.",
    icon: FileCheck2,
    status: "PLANNED",
    phase: "Q4 2026",
  },
  {
    title: "Mobile Money API Integration",
    description: "Payment reconciliation with supported mobile money operators.",
    icon: MonitorSmartphone,
    status: "PLANNED",
    phase: "2027",
  },
  {
    title: "GPS Tracking of Deliveries",
    description: "Depot-to-station delivery visibility, route monitoring, ETA, and receipt confirmation.",
    icon: Truck,
    status: "PLANNED",
    phase: "2027",
  },
];

const STATUS_META: Record<RoadmapStatus, { label: string; badge: string; icon: typeof CheckCircle2; summary: string }> = {
  DONE: {
    label: "Done",
    badge: "success",
    icon: CheckCircle2,
    summary: "Completed and available for current local testing or production baseline.",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "warning",
    icon: Clock3,
    summary: "Partly implemented; needs hardening before routine production use.",
  },
  PLANNED: {
    label: "Planned",
    badge: "neutral",
    icon: CircleDashed,
    summary: "Not yet implemented; candidate for future commercial upsell or integration sprint.",
  },
};

function groupByStatus(status: RoadmapStatus) {
  return ROADMAP_ITEMS.filter((item) => item.status === status);
}

const NEXT_SPRINT_ITEMS = ROADMAP_ITEMS.filter((item) => item.nextSprint);

export default async function RoadmapPage() {
  const session = await getRequiredSession();
  requireSuperAdmin(session);

  const done = groupByStatus("DONE");
  const inProgress = groupByStatus("IN_PROGRESS");
  const planned = groupByStatus("PLANNED");

  return (
    <>
      <PageTitle
        eyebrow="Super Admin"
        title="Product Roadmap"
        subtitle={`${done.length} done - ${inProgress.length} in progress - ${planned.length} planned`}
      />

      <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ padding: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <span className="kpi-icon" style={{ position: "static", flex: "0 0 auto" }}>
            <MapPinned size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ax-blue)", marginBottom: "0.35rem" }}>
              Roadmap Review
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--ax-muted)", lineHeight: 1.6, maxWidth: "760px" }}>
              Completed work is marked as done. Remaining work is split between hardening items needed for production confidence and longer-term integrations that can become commercial upsell features.
            </p>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
          <span className="kpi-icon" style={{ position: "static", width: 34, height: 34 }}>
            <Clock3 size={16} />
          </span>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ax-blue)" }}>Next Sprint Priority</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--ax-muted)" }}>
              Focus items after the client Excel import test: import hardening, operational exception handling, and mobile discovery.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
          {NEXT_SPRINT_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="dash-panel">
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span className="kpi-icon" style={{ position: "static" }}>
                      <Icon size={17} />
                    </span>
                    <span className="status-badge warning">Next Sprint</span>
                  </div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-gold)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                    {item.phase}
                  </div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ax-blue)", marginBottom: "0.35rem" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "var(--ax-muted)", lineHeight: 1.5 }}>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(["DONE", "IN_PROGRESS", "PLANNED"] as RoadmapStatus[]).map((status) => {
        const meta = STATUS_META[status];
        const StatusIcon = meta.icon;
        const items = groupByStatus(status);

        return (
          <section key={status} style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
              <span className="kpi-icon" style={{ position: "static", width: 34, height: 34 }}>
                <StatusIcon size={16} />
              </span>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ax-blue)" }}>{meta.label}</h2>
                <p style={{ fontSize: "0.8rem", color: "var(--ax-muted)" }}>{meta.summary}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="dash-panel" style={status === "DONE" ? { opacity: 0.82 } : undefined}>
                    <div style={{ padding: "1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span className="kpi-icon" style={{ position: "static" }}>
                          <Icon size={17} />
                        </span>
                        <span className={`status-badge ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-gold)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                        {item.phase}
                      </div>
                      <h3
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "var(--ax-blue)",
                          marginBottom: "0.35rem",
                          textDecoration: status === "DONE" ? "line-through" : "none",
                          textDecorationThickness: status === "DONE" ? "2px" : undefined,
                        }}
                      >
                        {item.title}
                      </h3>
                      <p style={{ fontSize: "0.78rem", color: "var(--ax-muted)", lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
