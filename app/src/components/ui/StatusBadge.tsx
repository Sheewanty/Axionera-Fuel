import { CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

type SessionStatus = "OPEN" | "READY_FOR_REVIEW" | "APPROVED" | "REOPENED";

const STATUS_CONFIG: Record<SessionStatus, { label: string; icon: React.ElementType; css: string }> = {
  OPEN: { label: "Open", icon: Clock, css: "open" },
  READY_FOR_REVIEW: { label: "Ready for Review", icon: AlertCircle, css: "ready" },
  APPROVED: { label: "Approved", icon: CheckCircle, css: "approved" },
  REOPENED: { label: "Reopened", icon: RefreshCw, css: "reopened" },
};

export default function StatusBadge({ status }: { status: SessionStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;
  const Icon = config.icon;
  return (
    <span className={`status-badge ${config.css}`}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}
