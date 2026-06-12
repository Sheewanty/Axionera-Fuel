"use client";

import { Fuel, Banknote, Store, AlertTriangle, Droplets, BarChart3, CheckCircle, Clock } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import StatusBadge from "@/components/ui/StatusBadge";
import VarianceBadge from "@/components/ui/VarianceBadge";
import DataTable from "@/components/ui/DataTable";
import PageTitle from "@/components/ui/PageTitle";
import { formatCurrency, formatLitres } from "@/lib/calculations";


// ── Demo data — replace with real DB queries in M2 ───────────────────────────
const KPI_DATA = [
  { label: "Total Litres Sold", value: "18,469 L", icon: <Fuel size={16} />, delta: "+4.1% vs yesterday", deltaType: "positive" as const },
  { label: "Expected Forecourt Cash", value: "GHS 275,182", icon: <Banknote size={16} />, delta: "Super 95 + Diesel + Super 91", deltaType: "neutral" as const },
  { label: "Cash Banked", value: "GHS 273,182", icon: <Banknote size={16} />, delta: "–GHS 2,000 variance", deltaType: "negative" as const },
  { label: "Tank Variance / Loss", value: "–37 L", icon: <Droplets size={16} />, delta: "Within tolerance", deltaType: "neutral" as const },
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
  { id: "1", station: "GOIL Accra Central",  date: "2026-06-11", status: "READY_FOR_REVIEW", litresSold: 11469, cashBanked: 168182, variance: -1238 },
  { id: "2", station: "GOIL Kumasi Adum",    date: "2026-06-11", status: "OPEN",             litresSold: 7000,  cashBanked: 105000, variance: -762  },
];

interface Alert {
  id: string;
  severity: "danger" | "warning" | "ok";
  title: string;
  detail: string;
}

const ALERTS: Alert[] = [
  { id: "a1", severity: "danger",  title: "Pump 2 Nozzle A — Cash Short GHS 820",  detail: "GOIL Accra Central · 11 Jun 2026 · Attendant: Abena Osei" },
  { id: "a2", severity: "warning", title: "Tank 2 Diesel Variance –37 L",           detail: "GOIL Accra Central · Closing stock lower than expected" },
];


export default function CommandCenterPage() {
  return (
    <>
      <PageTitle
        eyebrow="Command Center"
        title="Station Dashboard"
        subtitle={`Wednesday, 11 June 2026 · All stations`}
        actions={
          <button className="btn btn-primary">
            <Clock size={13} />
            Open New Day
          </button>
        }
      />

      {/* KPI Row */}
      <div className="kpi-grid">
        {KPI_DATA.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Station close status table */}
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

      {/* Alerts & Exceptions */}
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
