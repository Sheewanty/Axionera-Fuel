"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fuel, Banknote, Store, AlertTriangle, Droplets, BarChart3, CheckCircle, Clock } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import StatusBadge from "@/components/ui/StatusBadge";
import VarianceBadge from "@/components/ui/VarianceBadge";
import DataTable from "@/components/ui/DataTable";
import PageTitle from "@/components/ui/PageTitle";
import { formatCurrency, formatLitres } from "@/lib/calculations";
import { openTodaySessionAction } from "@/lib/actions/daily-session.actions";

const KPI_DATA = [
  { label: "Total Litres Sold", value: "18,469 L", icon: <Fuel size={16} />, delta: "+4.1% vs yesterday", deltaType: "positive" as const },
  { label: "Expected Forecourt Cash", value: "GHS 275,182", icon: <Banknote size={16} />, delta: "Super 95 + Diesel + Super 91", deltaType: "neutral" as const },
  { label: "Cash Banked", value: "GHS 273,182", icon: <Banknote size={16} />, delta: "GHS 2,000 short", deltaType: "negative" as const },
  { label: "Tank Variance / Loss", value: "37 L short", icon: <Droplets size={16} />, delta: "Within tolerance", deltaType: "neutral" as const },
  { label: "Mart Net Sales", value: "GHS 13,510", icon: <Store size={16} />, delta: "+GHS 870 vs target", deltaType: "positive" as const },
  { label: "Open Exceptions", value: "2", icon: <AlertTriangle size={16} />, delta: "Requires attention", deltaType: "negative" as const },
];

interface StationStatus {
  id: string;
  station: string;
  date: string;
  status: "OPEN" | "READY_FOR_REVIEW" | "APPROVED" | "REOPENED";
  litresSold: number;
  cashBanked: number;
  variance: number;
}

const STATION_STATUS: StationStatus[] = [
  { id: "1", station: "GOIL Accra Central", date: "11-Jun-2026", status: "READY_FOR_REVIEW", litresSold: 11469, cashBanked: 168182, variance: -1238 },
  { id: "2", station: "GOIL Kumasi Adum", date: "11-Jun-2026", status: "OPEN", litresSold: 7000, cashBanked: 105000, variance: -762 },
];

interface Alert {
  id: string;
  severity: "danger" | "warning" | "ok";
  title: string;
  detail: string;
}

const ALERTS: Alert[] = [
  { id: "a1", severity: "danger", title: "Pump 2 Nozzle A - Cash Short GHS 820", detail: "GOIL Accra Central | 11-Jun-2026 | Attendant: Abena Osei" },
  { id: "a2", severity: "warning", title: "Tank 2 Diesel Variance 37 L short", detail: "GOIL Accra Central | Closing stock lower than expected" },
];

export default function CommandCenterClient({
  stationId,
  stationName,
  businessDate,
  dailySessionStatus,
}: {
  stationId: string;
  stationName: string;
  businessDate: string;
  dailySessionStatus: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <PageTitle
        eyebrow="Command Center"
        title="Global Dashboard"
        subtitle={`${stationName} | ${businessDate} | Status: ${dailySessionStatus?.replace(/_/g, " ") ?? "No session open"}`}
        actions={
          <button className="btn btn-primary" onClick={handleOpenNewDay} disabled={isPending}>
            <Clock size={13} />
            {isPending ? "Opening..." : "Open New Day"}
          </button>
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

      <div className="kpi-grid">
        {KPI_DATA.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mb-5">
        <DataTable<StationStatus>
          title="Daily Close Status"
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
              header: "Variance",
              align: "right",
              computed: true,
              render: (row) => (
                <VarianceBadge
                  value={row.variance}
                  format={(v) => formatCurrency(Math.abs(v)) + (v < 0 ? " short" : " over")}
                />
              ),
            },
          ]}
          data={STATION_STATUS}
          getRowKey={(r) => r.id}
        />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <div>
            <div className="dash-panel-title">Alerts & Unresolved Exceptions</div>
            <div className="dash-panel-sub">Ranked by financial impact</div>
          </div>
          <button className="btn btn-outline btn-sm">
            <BarChart3 size={12} />
            View All
          </button>
        </div>
        <div className="insight-list">
          {ALERTS.map((alert) => (
            <div key={alert.id} className={`insight-card ${alert.severity}`}>
              <div className="insight-title">
                {alert.severity === "danger" && <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-red)" }} />}
                {alert.severity === "warning" && <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-amber)" }} />}
                {alert.severity === "ok" && <CheckCircle size={13} style={{ display: "inline", marginRight: 6, color: "var(--ax-green)" }} />}
                {alert.title}
              </div>
              <div className="insight-detail">{alert.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
