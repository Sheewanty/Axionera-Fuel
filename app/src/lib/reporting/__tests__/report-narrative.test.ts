import { describe, expect, it } from "vitest";
import type { ReportFacts } from "@/lib/reporting/report-context";
import { buildFallbackNarrative, buildReportNarrative } from "@/lib/reporting/report-narrative";

const facts: ReportFacts = {
  title: "Daily Station Control Report",
  subtitle: "Akwaaba Energy Ltd | Accra | 20-Jun-2026",
  templateKey: "daily_station_control",
  tenantName: "Akwaaba Energy Ltd",
  stationName: "Accra",
  generatedAt: "2026-06-22T12:00:00.000Z",
  periodFrom: "2026-06-20T00:00:00.000Z",
  periodTo: "2026-06-20T00:00:00.000Z",
  metrics: [
    { label: "Total Litres", value: "950.00 L", note: "Closing pump readings" },
    { label: "Banking Variance", value: "(GHS) 0.00", note: "Banked minus expected cash", status: "positive" },
  ],
  sections: [
    {
      title: "Banking Reconciliation",
      body: "Bankable cash uses the approved station rule.",
      bullets: ["Pump cash: (GHS) 9,700.00."],
      metrics: [],
    },
  ],
  sources: [],
  totals: {
    sessionCount: 1,
    bankingVariance: 0,
    tankVarianceLitres: 0,
    waterDetections: 0,
  },
};

describe("report narrative", () => {
  it("builds a deterministic fallback without inventing sections", () => {
    const narrative = buildFallbackNarrative(facts);

    expect(narrative.title).toBe(facts.title);
    expect(narrative.metrics).toEqual(facts.metrics);
    expect(narrative.sections).toEqual(facts.sections);
    expect(narrative.evidenceWarnings).toContain("No source daily sessions were available for the selected scope.");
  });

  it("does not call OpenAI when reporting env is not fully configured", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_REPORT_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_REPORT_MODEL;

    const result = await buildReportNarrative(facts, true);

    process.env.OPENAI_API_KEY = previousKey;
    process.env.OPENAI_REPORT_MODEL = previousModel;

    expect(result.usedOpenAi).toBe(false);
    expect(result.model).toBe("deterministic-fallback-openai-not-configured");
    expect(result.warning).toBe("OpenAI reporting is not configured.");
  });
});
