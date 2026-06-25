"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Banknote, BarChart3, Brain, CalendarDays, FileText, Gauge, Loader2, Presentation, Wrench } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { ReportFormat, ReportTemplateKey } from "@/lib/reporting/report-templates";

export interface ReportTemplate {
  id: string;
  engineKey?: ReportTemplateKey;
  title: string;
  description: string;
  category: string;
  formats: ReportFormat[];
  stationScoped: boolean;
  status: "Available" | "Planned";
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "daily-station-control",
    engineKey: "daily_station_control",
    title: "Daily Station Control Report",
    description: "Daily operational summary including pump readings, tank dipping, cash reconciliation, lube bay, mart, and variance checks.",
    category: "Daily Operations",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "owner-executive-brief",
    engineKey: "owner_executive_brief",
    title: "Owner Executive Daily Brief",
    description: "Cross-station executive summary with KPIs, exceptions, and management recommendations.",
    category: "Daily Operations",
    formats: ["PDF", "PPTX"],
    stationScoped: false,
    status: "Available",
  },
  {
    id: "pump-sales",
    engineKey: "pump_sales",
    title: "Pump Sales Report",
    description: "Fuel sales by product, station, payment channel, and variance.",
    category: "Financial Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "tank-loss-variance",
    engineKey: "tank_loss",
    title: "Tank Loss / Fuel Variance Report",
    description: "Tank dipping, product discharge, water-test, and stock variance evidence.",
    category: "Inventory & Variance",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "cash-reconciliation",
    engineKey: "banking_reconciliation",
    title: "Cash Reconciliation Report",
    description: "Expected bankable cash, actual banking, expenditure, debtor cash payments, and unresolved variance.",
    category: "Financial Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "credit-sales-debtors",
    engineKey: "debtors_exposure",
    title: "Credit Sales / Debtors Report",
    description: "Credit sales, debtor payments, outstanding exposure, and collection control summary.",
    category: "Financial Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: false,
    status: "Available",
  },
  {
    id: "tank-dip",
    engineKey: "tank_dip",
    title: "Tank Dip Report",
    description: "Dedicated tank dipping register with opening/closing stock levels and chart readings.",
    category: "Inventory & Variance",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "bank-deposit",
    engineKey: "bank_deposit",
    title: "Bank Deposit Report",
    description: "Bank deposits with collection references, dates, signatories, and unresolved pending banking.",
    category: "Financial Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "expense",
    engineKey: "expense",
    title: "Expense Report",
    description: "Station operational expenditure breakdown by category and approval evidence.",
    category: "Financial Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "lube-bay-services",
    engineKey: "lube_bay_services",
    title: "Lube Bay Services Report",
    description: "Lube bay services, product lines, payment mode, revenue, and variance.",
    category: "Lube Bay Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
  {
    id: "technician-performance",
    engineKey: "technician_performance",
    title: "Technician Performance Report",
    description: "Technician service count, revenue contribution, discounts, and exception trends.",
    category: "Lube Bay Reports",
    formats: ["PDF", "PPTX"],
    stationScoped: true,
    status: "Available",
  },
];

export const REPORT_CATEGORIES = [
  {
    id: "daily-ops",
    label: "Daily Operations",
    description: "Station control and executive summaries.",
    icon: BarChart3,
    count: REPORT_TEMPLATES.filter((template) => template.category === "Daily Operations").length,
  },
  {
    id: "financial",
    label: "Financial Reports",
    description: "Cash, banking, expenses, and debtors.",
    icon: Banknote,
    count: REPORT_TEMPLATES.filter((template) => template.category === "Financial Reports").length,
  },
  {
    id: "inventory",
    label: "Inventory & Variance",
    description: "Tank dipping, stock, and variance analysis.",
    icon: Gauge,
    count: REPORT_TEMPLATES.filter((template) => template.category === "Inventory & Variance").length,
  },
  {
    id: "lube-bay",
    label: "Lube Bay Reports",
    description: "Service records and technician performance.",
    icon: Wrench,
    count: REPORT_TEMPLATES.filter((template) => template.category === "Lube Bay Reports").length,
  },
  {
    id: "ai-insights",
    label: "Management / AI Insights",
    description: "Operational anomaly detection and insight.",
    icon: Brain,
    count: 0,
  },
];

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
  template: ReportTemplate | null;
  stations: { id: string; name: string }[];
}

type GenerateResult =
  | { status: "idle" }
  | { status: "success"; title: string; artifacts: { format: string; downloadUrl: string; fileSize: number }[]; usedOpenAi: boolean }
  | { status: "error"; message: string; fields?: { field: string; message: string }[] };

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  return toInputDate(new Date());
}

function getDatePreset(key: string): { from: string; to: string } {
  const now = new Date();
  const today = toInputDate(now);
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: toInputDate(y), to: toInputDate(y) };
    }
    case "last7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toInputDate(d), to: today };
    }
    case "mtd": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toInputDate(m), to: today };
    }
    default:
      return { from: today, to: today };
  }
}

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "mtd", label: "Month to Date" },
];

function defaultFormats(template: ReportTemplate, selected: string): ReportFormat[] {
  if (selected === "BOTH") return template.formats;
  return selected === "PPTX" ? ["PPTX"] : ["PDF"];
}

export function GenerateReportModal({ open, onClose, template, stations }: GenerateReportModalProps) {
  const [result, setResult] = useState<GenerateResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const defaultDate = useMemo(() => todayInputValue(), []);
  const [periodFrom, setPeriodFrom] = useState(defaultDate);
  const [periodTo, setPeriodTo] = useState(defaultDate);

  const applyPreset = useCallback((key: string) => {
    const p = getDatePreset(key);
    setPeriodFrom(p.from);
    setPeriodTo(p.to);
  }, []);

  const handleClose = () => {
    setResult({ status: "idle" });
    setPeriodFrom(defaultDate);
    setPeriodTo(defaultDate);
    onClose();
  };

  const handleGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!template?.engineKey) {
      setResult({ status: "error", message: "This report template is planned but not yet connected to the report engine." });
      return;
    }

    const form = new FormData(event.currentTarget);
    const selectedFormat = String(form.get("format") || "PDF");
    const stationId = String(form.get("stationId") || "");

    if (template.stationScoped && !stationId) {
      setResult({ status: "error", message: "Select a station before generating this report." });
      return;
    }

    startTransition(async () => {
      setResult({ status: "idle" });
      try {
        const response = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateKey: template.engineKey,
            stationId: stationId || undefined,
            periodFrom: periodFrom || defaultDate,
            periodTo: periodTo || defaultDate,
            formats: defaultFormats(template, selectedFormat),
            audience: String(form.get("audience") || ""),
            includeAiCommentary: form.get("includeAiCommentary") === "on",
          }),
        });

        const payload = (await response.json()) as {
          message?: string;
          fields?: { field: string; message: string }[];
          report?: {
            title: string;
            usedOpenAi: boolean;
            artifacts: { format: string; downloadUrl: string; fileSize: number }[];
          };
        };

        if (!response.ok || !payload.report) {
          setResult({ status: "error", message: payload.message || "Report generation failed.", fields: payload.fields });
          return;
        }

        setResult({
          status: "success",
          title: payload.report.title,
          artifacts: payload.report.artifacts,
          usedOpenAi: payload.report.usedOpenAi,
        });
      } catch (error) {
        setResult({
          status: "error",
          message: error instanceof Error ? error.message : "Report generation failed.",
        });
      }
    });
  };

  if (!template) return null;

  return (
    <Modal open={open} title="Generate Report" onClose={handleClose} size="md">
      <form onSubmit={handleGenerate}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}>
          <div className="form-group">
            <label className="form-label">Report Template</label>
            <input className="form-input" value={template.title} readOnly style={{ backgroundColor: "var(--ax-surface-2)", cursor: "not-allowed" }} />
          </div>

          <div className="form-group">
            <label className="form-label">Station</label>
            <select className="form-select" name="stationId" defaultValue="" disabled={!template.stationScoped}>
              {!template.stationScoped && <option value="">All Stations</option>}
              {template.stationScoped && <option value="">Select station</option>}
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date presets */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: "4px" }}>
              <CalendarDays size={12} style={{ marginRight: "4px", verticalAlign: "-1px" }} />
              Date Presets
            </label>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => applyPreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input className="form-input" name="periodFrom" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input className="form-input" name="periodTo" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Output Format</label>
            <select className="form-select" name="format" defaultValue={template.formats.includes("PDF") ? "PDF" : template.formats[0]}>
              {template.formats.includes("PDF") && <option value="PDF">PDF</option>}
              {template.formats.includes("PPTX") && <option value="PPTX">PPTX</option>}
              {template.formats.includes("PDF") && template.formats.includes("PPTX") && <option value="BOTH">Both PDF and PPTX</option>}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience</label>
            <select className="form-select" name="audience" defaultValue="Owner">
              <option value="Owner">Owner</option>
              <option value="Station Manager">Station Manager</option>
              <option value="Accountant">Accountant</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--ax-muted)" }}>
            <input type="checkbox" name="includeAiCommentary" />
            Include AI commentary when configured
          </label>

          {template.status === "Planned" && (
            <div className="alert-box warning">
              This report card is reserved for a future factual collector. It cannot be generated yet.
            </div>
          )}

          {result.status === "error" && (
            <div className="alert-box danger">
              <strong>{result.message}</strong>
              {result.fields && result.fields.length > 0 && (
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem" }}>
                  {result.fields.map((field) => (
                    <li key={`${field.field}-${field.message}`}>{field.field}: {field.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result.status === "success" && (
            <div className="alert-box success">
              <strong>{result.title} generated.</strong>
              <div style={{ marginTop: "0.65rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {result.artifacts.map((artifact) => (
                  <a key={artifact.format} className="btn btn-outline btn-sm" href={artifact.downloadUrl}>
                    {artifact.format === "PPTX" ? <Presentation size={14} /> : <FileText size={14} />}
                    Download {artifact.format}
                  </a>
                ))}
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--ax-muted)" }}>
                AI commentary: {result.usedOpenAi ? "included" : "deterministic fallback used"}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isPending || template.status === "Planned"}>
            {isPending && <Loader2 size={15} className="spin" />}
            {isPending ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ReportTemplateCardProps {
  template: ReportTemplate;
  onGenerate: (template: ReportTemplate) => void;
}

export function ReportTemplateCard({ template, onGenerate }: ReportTemplateCardProps) {
  return (
    <div className="dash-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ padding: "1.25rem 1.25rem 0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-gold)" }}>
            {template.category}
          </div>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              color: template.status === "Available" ? "var(--ax-green)" : "var(--ax-muted)",
            }}
          >
            {template.status}
          </span>
        </div>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ax-blue)", marginBottom: "0.35rem" }}>{template.title}</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--ax-muted)", lineHeight: 1.5 }}>{template.description}</p>
      </div>
      <div style={{ padding: "0.75rem 1.25rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {template.formats.map((format) => (
            <span
              key={format}
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: format === "PDF" ? "rgba(185,28,28,0.08)" : "rgba(217,119,6,0.08)",
                color: format === "PDF" ? "var(--ax-red)" : "var(--ax-amber)",
              }}
            >
              {format}
            </span>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onGenerate(template)} disabled={template.status === "Planned"}>
          Generate
        </button>
      </div>
    </div>
  );
}
