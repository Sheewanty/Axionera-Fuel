import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ReportFacts } from "@/lib/reporting/report-context";
import { buildFallbackNarrative } from "@/lib/reporting/report-narrative";
import { renderReportArtifacts } from "@/lib/reporting/report-renderer";

const outputDir = path.join(os.tmpdir(), `fuelstation-report-test-${Date.now()}`);

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
    { label: "Expected Revenue", value: "(GHS) 14,762.50", note: "Meter sales value" },
  ],
  sections: [
    {
      title: "Product Sales",
      body: "Fuel sales grouped by product.",
      bullets: ["Super 95: 950.00 L sold."],
      metrics: [],
    },
  ],
  sources: [
    {
      sourceType: "DailySession",
      sourceId: "session-1",
      sourceLabel: "Accra 20-Jun-2026 DAY",
      sourceSnapshot: { status: "APPROVED" },
    },
  ],
  totals: {
    sessionCount: 1,
    bankingVariance: 0,
    tankVarianceLitres: 0,
    waterDetections: 0,
  },
};

afterEach(async () => {
  delete process.env.REPORT_OUTPUT_DIR;
  await fsp.rm(outputDir, { recursive: true, force: true });
});

describe("report renderer", () => {
  it("creates PDF and PPTX artifacts", async () => {
    process.env.REPORT_OUTPUT_DIR = outputDir;

    const artifacts = await renderReportArtifacts({
      reportId: "report-test",
      tenantId: "tenant-test",
      narrative: buildFallbackNarrative(facts),
      facts,
      formats: ["PDF", "PPTX"],
    });

    expect(artifacts.map((artifact) => artifact.format).sort()).toEqual(["PDF", "PPTX"]);
    for (const artifact of artifacts) {
      expect(artifact.fileSize).toBeGreaterThan(1000);
      expect(artifact.checksum).toHaveLength(64);
      await expect(fsp.access(artifact.filePath)).resolves.toBeUndefined();
    }
  });
});
