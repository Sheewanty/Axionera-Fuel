"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Fuel, Banknote, Droplets, Store, AlertTriangle, TrendingDown } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import VarianceBadge from "@/components/ui/VarianceBadge";
import DataTable from "@/components/ui/DataTable";
import PageTitle from "@/components/ui/PageTitle";
import { formatCurrency, formatLitres } from "@/lib/calculations";

// Demo data — replace with real DB queries in M2
const CROSS_STATION_KPIS = [
  { label: "Total Litres (All Stations)", value: "57,340 L",     icon: <Fuel size={16} />, delta: "+6.3% vs last week",           deltaType: "positive" as const },
  { label: "Expected Revenue",            value: "GHS 843,180",  icon: <Banknote size={16} />, delta: "Across 2 stations",        deltaType: "neutral"  as const },
  { label: "Cash Banked",                 value: "GHS 839,620",  icon: <Banknote size={16} />, delta: "–GHS 3,560 variance",      deltaType: "negative" as const },
  { label: "Total Tank Loss",             value: "–148 L",        icon: <Droplets size={16} />, delta: "Investigate Kumasi Adum",  deltaType: "negative" as const },
  { label: "Mart Net Sales",              value: "GHS 61,240",   icon: <Store size={16} />, delta: "+9% vs last week",            deltaType: "positive" as const },
  { label: "Net Cash Position",           value: "GHS 895,860",  icon: <Banknote size={16} />, delta: "After expenditure",        deltaType: "positive" as const },
];

const TREND_DATA = [
  { date: "Mon", litres: 11200, cashBanked: 164528,  variance: -680  },
  { date: "Tue", litres: 12400, cashBanked: 182164,  variance: -920  },
  { date: "Wed", litres: 10900, cashBanked: 160111,  variance: -540  },
  { date: "Thu", litres: 13800, cashBanked: 202734,  variance: -1380 },
  { date: "Fri", litres: 15200, cashBanked: 223388,  variance: -1860 },
  { date: "Sat", litres: 16800, cashBanked: 246768,  variance: -2700 },
  { date: "Sun", litres: 12840, cashBanked: 188587,  variance: -1180 },
];

interface StationRow {
  id: string;
  station: string;
  litresSold: number;
  expectedRev: number;
  cashBanked: number;
  variance: number;
  tankLoss: number;
  martSales: number;
}

const STATION_COMPARISON: StationRow[] = [
  { id: "1", station: "GOIL Accra Central", litresSold: 34140, expectedRev: 501775, cashBanked: 499284, variance: -2491, tankLoss: -48,  martSales: 36740 },
  { id: "2", station: "GOIL Kumasi Adum",   litresSold: 23200, expectedRev: 341405, cashBanked: 340336, variance: -1069, tankLoss: -100, martSales: 24500 },
];

interface ExceptionItem {
  id: string;
  severity: "danger" | "warning";
  title: string;
  detail: string;
  amount: number;
}

const EXCEPTIONS: ExceptionItem[] = [
  { id: "e1", severity: "danger",  title: "GOIL Kumasi Adum — Tank 2 Diesel Loss 100 L",         detail: "Exceeds 30 L/day threshold. Check discharge records vs dipping measurements.", amount: -1445 },
  { id: "e2", severity: "danger",  title: "GOIL Accra Central — Pump 2 Cash Short GHS 1,820",   detail: "3-day pattern of under-collection on nozzle A. Supervisor review required.",    amount: -1820 },
  { id: "e3", severity: "warning", title: "GOIL Accra Central — Mart Cash Variance GHS 410",    detail: "Cash count below net mart sales for 2 consecutive days.",                      amount: -410  },
];

export default function OwnerDashboardPage() {
  const [range, setRange] = useState<"7d" | "30d">("7d");

  return (
    <>
      <PageTitle
        eyebrow="Owner Dashboard"
        title="Cross-Station Analytics"
        subtitle="GOIL Ghana Ltd · All stations · 05-Jun-2026 to 11-Jun-2026"
        actions={
          <div className="flex gap-2">
            <button className={`btn ${range === "7d" ? "btn-primary" : "btn-outline"} btn-sm`} onClick={() => setRange("7d")}>7 Days</button>
            <button className={`btn ${range === "30d" ? "btn-primary" : "btn-outline"} btn-sm`} onClick={() => setRange("30d")}>30 Days</button>
            <button className="btn btn-gold btn-sm">Export PDF</button>
          </div>
        }
      />

      {/* Cross-station KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {CROSS_STATION_KPIS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Trend charts */}
      <div className="dash-grid mb-5">
        {/* Litres sold trend */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">Litres Sold — 7-Day Trend</div>
              <div className="dash-panel-sub">All stations combined</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={TREND_DATA} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="litreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#162750" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#162750" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,39,80,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7a92" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7a92" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ fontSize: 12, borderColor: "#CBD5E1" }} />
              <Area type="monotone" dataKey="litres" stroke="#162750" fill="url(#litreGrad)" strokeWidth={2} dot={false} name="Litres" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Banking variance trend */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">Banking Variance — 7-Day</div>
              <div className="dash-panel-sub">Cash banked vs expected</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={TREND_DATA} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,39,80,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7a92" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7a92" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ fontSize: 12, borderColor: "#CBD5E1" }} formatter={(v) => [`GHS ${Math.abs(Number(v)).toLocaleString()}`, "Variance"]} />
              <Bar dataKey="variance" fill="#B91C1C" radius={[3,3,0,0]} name="Variance" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Station comparison table */}
      <div className="mb-5">
        <DataTable<StationRow>
          title="Station Performance Comparison"
          columns={[
            { key: "station", header: "Station" },
            { key: "litresSold", header: "Litres Sold", align: "right", render: (r) => formatLitres(r.litresSold) },
            { key: "expectedRev", header: "Expected Revenue", align: "right", render: (r) => formatCurrency(r.expectedRev) },
            { key: "cashBanked", header: "Cash Banked", align: "right", render: (r) => formatCurrency(r.cashBanked) },
            {
              key: "variance",
              header: "Banking Variance",
              align: "right",
              computed: true,
              render: (r) => <VarianceBadge value={r.variance} format={(v) => formatCurrency(Math.abs(v)) + (v < 0 ? " short" : " over")} />,
            },
            { key: "tankLoss", header: "Tank Loss (L)", align: "right", computed: true, render: (r) => <VarianceBadge value={r.tankLoss} format={(v) => `${v} L`} /> },
            { key: "martSales", header: "Mart Sales", align: "right", render: (r) => formatCurrency(r.martSales) },
          ]}
          data={STATION_COMPARISON}
          getRowKey={(r) => r.id}
        />
      </div>

      {/* Exception list + Insight cards */}
      <div className="dash-grid">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">Top Exceptions</div>
              <div className="dash-panel-sub">Ranked by financial impact</div>
            </div>
          </div>
          <div className="insight-list">
            {EXCEPTIONS.map((ex) => (
              <div key={ex.id} className={`insight-card ${ex.severity}`}>
                <div className="insight-title" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <span>
                    <AlertTriangle size={12} style={{ display: "inline", marginRight: 5 }} />
                    {ex.title}
                  </span>
                  <VarianceBadge value={ex.amount} format={(v) => formatCurrency(Math.abs(v))} />
                </div>
                <div className="insight-detail">{ex.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">Insight Cards</div>
              <div className="dash-panel-sub">Highest-risk variances explained</div>
            </div>
          </div>
          <div className="insight-list">
            <div className="insight-card danger">
              <div className="insight-title"><TrendingDown size={12} style={{ display: "inline", marginRight: 5 }} />Tank Loss Pattern Detected</div>
              <div className="insight-detail">GOIL Kumasi Adum Diesel tank shows 100 L loss over 3 days. This is above the 30 L/day acceptable threshold. Recommend physical inspection of tank seals and comparison against product discharge records.</div>
            </div>
            <div className="insight-card warning">
              <div className="insight-title"><TrendingDown size={12} style={{ display: "inline", marginRight: 5 }} />Recurring Cash Short — Pump 2 Nozzle A</div>
              <div className="insight-detail">GOIL Accra Central Pump 2 Nozzle A has been short GHS 420–GHS 1,820 per day for the past 4 days. Suggest reconciliation review with Abena Osei and shift supervisor Kofi Asante.</div>
            </div>
            <div className="insight-card ok">
              <div className="insight-title">Mart Sales Trending Up</div>
              <div className="insight-detail">Combined mart sales grew 12% this week vs last week. Both stations are above target. No action required.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
