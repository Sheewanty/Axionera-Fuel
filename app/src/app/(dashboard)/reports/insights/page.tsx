import { AlertTriangle, BarChart3, Brain, Droplets, Gauge, ShieldAlert, TrendingUp, Wrench } from "lucide-react";
import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";

const INSIGHT_TYPES = [
  {
    title: "Tank Leakage Detection",
    description: "Identifies gradual stock losses that may indicate underground tank leaks by analysing dipping variance trends.",
    icon: Droplets,
  },
  {
    title: "Water Intrusion Detection",
    description: "Flags water contamination from water-test records and abnormal tank movement patterns.",
    icon: Droplets,
  },
  {
    title: "Pump Calibration Problem",
    description: "Highlights pumps where meter readings consistently deviate from stock and revenue expectations.",
    icon: Gauge,
  },
  {
    title: "Fuel Theft Detection",
    description: "Surfaces suspicious stock losses that exceed normal operational tolerance thresholds.",
    icon: ShieldAlert,
  },
  {
    title: "Meter Manipulation",
    description: "Detects unusual meter movement patterns, missing openings, or suspicious corrections.",
    icon: Gauge,
  },
  {
    title: "Attendant Fraud Detection",
    description: "Analyses attendant-level variance, shortages, and repeated exception patterns.",
    icon: AlertTriangle,
  },
  {
    title: "Delivery Loss Detection",
    description: "Compares invoice quantities, discharge records, top-up adjustments, and after-tank measurements.",
    icon: TrendingUp,
  },
  {
    title: "Abnormal Consumption Trends",
    description: "Compares sales and stock movement against historical station and product baselines.",
    icon: BarChart3,
  },
  {
    title: "Pump Performance Ranking",
    description: "Ranks pumps by throughput, variance frequency, and maintenance attention needed.",
    icon: BarChart3,
  },
  {
    title: "Predictive Maintenance",
    description: "Uses repeated exceptions to prioritise pump, tank, and lube bay maintenance checks.",
    icon: Wrench,
  },
];

export default async function AIInsightsPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "AUDITOR"]);

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="AI Insights"
        subtitle="Planned operational anomaly analysis based on deterministic station data."
      />

      <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ padding: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <span className="kpi-icon" style={{ position: "static", flex: "0 0 auto" }}>
            <Brain size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ax-blue)", marginBottom: "0.35rem" }}>
              Operational Intelligence Roadmap
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--ax-muted)", lineHeight: 1.6, maxWidth: "660px" }}>
              These insight types will be generated from verified station records. The AI layer will explain patterns and recommend investigations, but the underlying facts will remain deterministic.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.875rem" }}>
        {INSIGHT_TYPES.map((insight) => {
          const Icon = insight.icon;
          return (
            <div key={insight.title} className="dash-panel" style={{ opacity: 0.82 }}>
              <div style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span className="kpi-icon" style={{ position: "static" }}>
                    <Icon size={17} />
                  </span>
                  <span className="status-badge warning">Planned</span>
                </div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ax-blue)", marginBottom: "0.35rem" }}>
                  {insight.title}
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--ax-muted)", lineHeight: 1.5 }}>
                  {insight.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

