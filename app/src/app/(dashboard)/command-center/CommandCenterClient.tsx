"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, BarChart3, CheckCircle, Clock, Droplets, Fuel, Store } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import PageTitle from "@/components/ui/PageTitle";
import StatusBadge from "@/components/ui/StatusBadge";
import VarianceBadge from "@/components/ui/VarianceBadge";
import { openTodaySessionAction } from "@/lib/actions/daily-session.actions";
import { formatCurrency, formatLitres } from "@/lib/calculations";

export type CommandCenterMetrics = {
  totalLitresSold: number;
  expectedForecourtRevenue: number;
  cashBanked: number;
  bankingVariance: number;
  tankVarianceLitres: number;
  martNetSales: number;
  openExceptions: number;
  hasOperationalData: boolean;
};

export type StationStatusRow = {
  id: string;
  station: string;
  date: string;
  status: "OPEN" | "READY_FOR_REVIEW" | "APPROVED" | "REOPENED";
  litresSold: number;
  cashBanked: number;
  variance: number;
};

export type CommandCenterAlert = {
  id: string;
  severity: "danger" | "warning" | "ok";
  title: string;
  detail: string;
  amount: number;
  unit: "currency" | "litres";
};

function varianceDelta(value: number, unit: "currency" | "litres") {
  if (value === 0) return "No variance";
  const direction = value < 0 ? "short" : "over";
  if (unit === "currency") return `${formatCurrency(Math.abs(value))} ${direction}`;
  return `${Math.abs(value).toLocaleString()} L ${direction}`;
}

export default function CommandCenterClient({
  stationId,
  stationName,
  businessDate,
  dailySessionStatus,
  metrics,
  statusRows,
  alerts,
}: {
  stationId: string;
  stationName: string;
  businessDate: string;
  dailySessionStatus: string | null;
  metrics: CommandCenterMetrics;
  statusRows: StationStatusRow[];
  alerts: CommandCenterAlert[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasOpenSession = Boolean(dailySessionStatus);

  const handleOpenNewDay = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await openTodaySessionAction(stationId);

      if (!result.success) {
        setError(result.error ?? "Failed to open today's session");
        return;
      }

      setMessage("Today's session is open. You can now record pump readings, tank dipping, mart sales, and cash collection.");
      router.refresh();
    });
  };

  const kpis = [
    {
      label: "Total Litres Sold",
      value: formatLitres(metrics.totalLitresSold),
      icon: <Fuel size={16} />,
      delta: metrics.totalLitresSold === 0 ? "No pump readings recorded" : "From pump readings",
      deltaType: metrics.totalLitresSold === 0 ? "neutral" as const : "positive" as const,
    },
    {
      label: "Expected Forecourt Revenue",
      value: formatCurrency(metrics.expectedForecourtRevenue),
      icon: <Banknote size={16} />,
      delta: metrics.expectedForecourtRevenue === 0 ? "No closing sales recorded" : "Meter sales value",
      deltaType: "neutral" as const,
    },
    {
      label: "Cash Banked",
      value: formatCurrency(metrics.cashBanked),
      icon: <Banknote size={16} />,
      delta: varianceDelta(metrics.bankingVariance, "currency"),
      deltaType: metrics.bankingVariance === 0 ? "neutral" as const : "negative" as const,
    },
    {
      label: "Tank Variance / Loss",
      value: varianceDelta(metrics.tankVarianceLitres, "litres"),
      icon: <Droplets size={16} />,
      delta: metrics.tankVarianceLitres === 0 ? "No tank variance" : "Review tank dipping",
      deltaType: metrics.tankVarianceLitres === 0 ? "neutral" as const : "negative" as const,
    },
    {
      label: "Mart Net Sales",
      value: formatCurrency(metrics.martNetSales),
      icon: <Store size={16} />,
      delta: metrics.martNetSales === 0 ? "No mart summary recorded" : "From mart summary",
      deltaType: metrics.martNetSales === 0 ? "neutral" as const : "positive" as const,
    },
    {
      label: "Open Exceptions",
      value: String(metrics.openExceptions),
      icon: <AlertTriangle size={16} />,
      delta: metrics.openExceptions === 0 ? "No unresolved exceptions" : "Requires attention",
      deltaType: metrics.openExceptions === 0 ? "positive" as const : "negative" as const,
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="Command Center"
        title="Station Dashboard"
        subtitle={`${stationName} | ${businessDate} | Status: ${dailySessionStatus?.replace(/_/g, " ") ?? "No session open"}`}
        actions={
          hasOpenSession ? (
            <Link className="btn btn-outline" href={`/daily-close?stationId=${stationId}`}>
              <Clock size={13} />
              View Daily Close
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={handleOpenNewDay} disabled={isPending}>
              <Clock size={13} />
              {isPending ? "Opening..." : "Open New Day"}
            </button>
          )
        }
      />

      {message && (
        <div style={{ background: "color-mix(in srgb, var(--ax-green) 10%, white)", border: "1px solid color-mix(in srgb, var(--ax-green) 30%, white)", borderRadius: 8, color: "var(--ax-green)", padding: 12, marginBottom: 16, fontSize: 14 }}>
          {message}{" "}
          <Link href={`/daily-close?stationId=${stationId}`} style={{ color: "var(--ax-blue)", fontWeight: 700 }}>
            Go to Daily Close
          </Link>
        </div>
      )}

      {error && (
        <div style={{ background: "color-mix(in srgb, var(--ax-red) 8%, white)", border: "1px solid color-mix(in srgb, var(--ax-red) 30%, white)", borderRadius: 8, color: "var(--ax-red)", padding: 12, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {!hasOpenSession && (
        <div className="dash-panel" style={{ padding: 20, marginBottom: 20 }}>
          <div className="dash-panel-title">No Session Open</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            Open a new day to begin recording pump readings, tank dipping, product discharge, mart sales, and banking.
          </p>
        </div>
      )}

      {hasOpenSession && !metrics.hasOperationalData && (
        <div className="dash-panel" style={{ padding: 20, marginBottom: 20 }}>
          <div className="dash-panel-title">No Operational Records Yet</div>
          <p style={{ color: "var(--ax-muted)", marginTop: 8 }}>
            This day is open, but no pump readings, tank dipping, cash collection, or mart summary has been entered yet.
          </p>
        </div>
      )}

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mb-5">
        <DataTable<StationStatusRow>
          title="Daily Close Status"
          emptyMessage="No daily sessions have been opened for this station yet."
          columns={[
            { key: "station", header: "Station" },
            { key: "date", header: "Date" },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "litresSold",
              header: "Litres Sold",
              align: "right",
              render: (row) => formatLitres(row.litresSold),
            },
            {
              key: "cashBanked",
              header: "Cash Banked",
              align: "right",
              render: (row) => formatCurrency(row.cashBanked),
            },
            {
              key: "variance",
              header: "Banking Variance",
              align: "right",
              computed: true,
              render: (row) => (
                <VarianceBadge
                  value={row.variance}
                  format={(value) => formatCurrency(Math.abs(value)) + (value < 0 ? " short" : value > 0 ? " over" : "")}
                />
              ),
            },
          ]}
          data={statusRows}
          getRowKey={(row) => row.id}
        />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Alerts & Unresolved Exceptions</div>
            <div className="dash-panel-sub">Ranked by financial impact</div>
          </div>
          <Link className="btn btn-outline btn-sm" href={`/forecourt/variance-review?stationId=${stationId}`}>
            <BarChart3 size={12} />
            View All
          </Link>
        </div>
        <div className="insight-list">
          {alerts.length === 0 ? (
            <div style={{ padding: "18px 1.25rem", color: "var(--ax-muted)", fontSize: 14 }}>
              No unresolved exceptions for this station day.
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className={`insight-card ${alert.severity}`}>
                <div className="insight-title">
                  {alert.severity === "danger" && <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-red)" }} />}
                  {alert.severity === "warning" && <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-amber)" }} />}
                  {alert.severity === "ok" && <CheckCircle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-green)" }} />}
                  {alert.title} ({varianceDelta(alert.amount, alert.unit)})
                </div>
                <div className="insight-detail">{alert.detail}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
