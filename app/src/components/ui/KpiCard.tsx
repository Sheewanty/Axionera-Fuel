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

function splitValueUnit(value: string): { value: string; unit: string | null } {
  const trimmed = value.trim();

  const currencyMatch = trimmed.match(/^(-?)(?:GHS|GH\u20b5|GH\u00a2)\s?(.+)$/);
  if (currencyMatch) {
    return {
      value: `${currencyMatch[1]}${currencyMatch[2]}`.trim(),
      unit: "GHS",
    };
  }

  const litreWithQualifierMatch = trimmed.match(/^(-?[\d,.]+)\s+L\s+(.+)$/);
  if (litreWithQualifierMatch) {
    return {
      value: `${litreWithQualifierMatch[1]} ${litreWithQualifierMatch[2]}`,
      unit: "L",
    };
  }

  const litreMatch = trimmed.match(/^(-?[\d,.]+)\s+L$/);
  if (litreMatch) {
    return {
      value: litreMatch[1],
      unit: "L",
    };
  }

  return { value, unit: null };
}

export default function KpiCard({ label, value, icon, delta, deltaType = "neutral", variance }: KpiCardProps) {
  // Auto-derive deltaType from variance if provided
  let resolvedDeltaType = deltaType;
  if (variance !== undefined) {
    const sev = varianceSeverity(variance);
    resolvedDeltaType = sev === "ok" ? "positive" : sev === "warning" ? "neutral" : "negative";
  }

  const display = splitValueUnit(value);

  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <div className="kpi-label">
          {label}
          {display.unit && <span className="kpi-unit"> ({display.unit})</span>}
        </div>
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-value">{display.value}</div>
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
