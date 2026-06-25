import { describe, expect, it } from "vitest";
import { getReportTemplate, normalizeReportFormats, REPORT_TEMPLATES } from "@/lib/reporting/report-templates";

describe("report templates", () => {
  it("exposes commercially important report templates", () => {
    expect(REPORT_TEMPLATES.map((template) => template.key)).toEqual(
      expect.arrayContaining([
        "daily_station_control",
        "owner_executive_brief",
        "pump_sales",
        "tank_dip",
        "tank_loss",
        "banking_reconciliation",
        "bank_deposit",
        "debtors_exposure",
        "expense",
        "lube_bay_services",
        "technician_performance",
      ])
    );
  });

  it("marks station-scoped report types correctly", () => {
    expect(getReportTemplate("owner_executive_brief")?.stationScoped).toBe(false);
    expect(getReportTemplate("debtors_exposure")?.stationScoped).toBe(false);
    expect(getReportTemplate("tank_dip")?.stationScoped).toBe(true);
    expect(getReportTemplate("lube_bay_services")?.stationScoped).toBe(true);
  });

  it("normalizes requested output formats", () => {
    expect(normalizeReportFormats(["pdf", "PPTX", "docx", "PDF"])).toEqual(["PDF", "PPTX"]);
    expect(normalizeReportFormats([])).toEqual(["PDF"]);
    expect(normalizeReportFormats("pdf")).toEqual(["PDF"]);
  });

  it("returns null for unknown templates", () => {
    expect(getReportTemplate("unknown")).toBeNull();
  });
});
