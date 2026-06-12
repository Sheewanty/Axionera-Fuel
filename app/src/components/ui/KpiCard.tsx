import { varianceSeverity } from "@/lib/calculations";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  variance?: number;
}

export default function KpiCard({ label, value, icon, delta, deltaType = "neutral", variance }: KpiCardProps) {
  // Auto-derive deltaType from variance if provided
  let resolvedDeltaType = deltaType;
  if (variance !== undefined) {
    const sev = varianceSeverity(variance);
    resolvedDeltaType = sev === "ok" ? "positive" : sev === "warning" ? "neutral" : "negative";
  }

  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <span className={`kpi-delta ${resolvedDeltaType}`}>
          {resolvedDeltaType === "positive" && <TrendingUp size={10} />}
          {resolvedDeltaType === "negative" && <TrendingDown size={10} />}
          {resolvedDeltaType === "neutral" && <Minus size={10} />}
          {delta}
        </span>
      )}
    </div>
  );
}
