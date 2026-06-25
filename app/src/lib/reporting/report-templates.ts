export type ReportFormat = "PDF" | "PPTX";

export type ReportTemplateKey =
  | "daily_station_control"
  | "owner_executive_brief"
  | "pump_sales"
  | "tank_dip"
  | "tank_loss"
  | "banking_reconciliation"
  | "bank_deposit"
  | "debtors_exposure"
  | "expense"
  | "lube_bay_services"
  | "technician_performance";

export interface ReportTemplate {
  key: ReportTemplateKey;
  title: string;
  description: string;
  defaultAudience: string;
  stationScoped: boolean;
  recommendedFormats: ReportFormat[];
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    key: "daily_station_control",
    title: "Daily Station Control Report",
    description: "Daily forecourt, tank, mart, lube bay, expenditure, banking, and exception summary.",
    defaultAudience: "Station Manager",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "owner_executive_brief",
    title: "Owner Executive Daily Brief",
    description: "Cross-station executive summary with revenue, cash, tank variance, and exception highlights.",
    defaultAudience: "Owner",
    stationScoped: false,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "pump_sales",
    title: "Pump Sales Report",
    description: "Fuel sales by station, product, nozzle, payment channel, and variance.",
    defaultAudience: "Operations",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "tank_dip",
    title: "Tank Dip Report",
    description: "Tank dipping register with opening stock, receipts, closing stock, meter sold, water-test status, and variance.",
    defaultAudience: "Operations",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "tank_loss",
    title: "Tank Loss / Fuel Variance Report",
    description: "Tank dipping, receipts, product discharge, water-test, and stock variance evidence.",
    defaultAudience: "Operations",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "banking_reconciliation",
    title: "Banking Reconciliation Report",
    description: "Expected bankable cash, actual banking, prior collections, and unresolved variances.",
    defaultAudience: "Accountant",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "bank_deposit",
    title: "Bank Deposit Report",
    description: "Bank collection register by business date, bank date, collection reference, signatories, expected cash, and variance.",
    defaultAudience: "Accountant",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "debtors_exposure",
    title: "Debtors / Credit Exposure Report",
    description: "Credit sales, debtor payments, outstanding exposure, and collection control summary.",
    defaultAudience: "Accountant",
    stationScoped: false,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "expense",
    title: "Expense Report",
    description: "Actual station expenditures by category, voucher, approver, receipt status, and operational day.",
    defaultAudience: "Accountant",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "lube_bay_services",
    title: "Lube Bay Services Report",
    description: "Lube bay services, product charges, labour, discounts, payment channels, and variances.",
    defaultAudience: "Operations",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
  {
    key: "technician_performance",
    title: "Technician Performance Report",
    description: "Technician service count, expected revenue, cash received, discounts, and variance ranking.",
    defaultAudience: "Operations",
    stationScoped: true,
    recommendedFormats: ["PDF", "PPTX"],
  },
];

export function getReportTemplate(key: string): ReportTemplate | null {
  return REPORT_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function normalizeReportFormats(value: unknown): ReportFormat[] {
  if (!Array.isArray(value)) return ["PDF"];

  const formats = value
    .map((item) => String(item).toUpperCase())
    .filter((item): item is ReportFormat => item === "PDF" || item === "PPTX");

  return formats.length > 0 ? Array.from(new Set(formats)) : ["PDF"];
}
