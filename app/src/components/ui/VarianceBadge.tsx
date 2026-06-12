import { varianceSeverity } from "@/lib/calculations";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface VarianceBadgeProps {
  value: number;
  format?: (v: number) => string;
  warningThreshold?: number;
  dangerThreshold?: number;
}

export default function VarianceBadge({
  value,
  format = (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
  warningThreshold,
  dangerThreshold,
}: VarianceBadgeProps) {
  const severity = varianceSeverity(value, warningThreshold, dangerThreshold);
  return (
    <span className={`variance-badge ${severity}`}>
      {value > 0 && <TrendingUp size={10} />}
      {value < 0 && <TrendingDown size={10} />}
      {value === 0 && <Minus size={10} />}
      {format(value)}
    </span>
  );
}
