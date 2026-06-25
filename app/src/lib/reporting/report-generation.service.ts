import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { StationSummary } from "@/lib/db/station.service";
import { collectReportFacts } from "@/lib/reporting/report-context";
import { buildReportNarrative } from "@/lib/reporting/report-narrative";
import { renderReportArtifacts } from "@/lib/reporting/report-renderer";
import {
  getReportTemplate,
  normalizeReportFormats,
  type ReportFormat,
  type ReportTemplateKey,
} from "@/lib/reporting/report-templates";

export interface GenerateReportInput {
  tenantId: string;
  userId: string;
  templateKey: ReportTemplateKey;
  stationId?: string;
  periodFrom: Date;
  periodTo: Date;
  formats: ReportFormat[];
  audience?: string;
  includeAiCommentary?: boolean;
  accessibleStations: StationSummary[];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function generateReportRun(input: GenerateReportInput) {
  const template = getReportTemplate(input.templateKey);
  if (!template) throw new Error("Unknown report template.");

  if (template.stationScoped && !input.stationId) {
    throw new Error("This report requires a station.");
  }

  if (input.periodFrom > input.periodTo) {
    throw new Error("Report start date cannot be after end date.");
  }

  const stationAllowed = input.stationId
    ? input.accessibleStations.some((station) => station.id === input.stationId)
    : true;

  if (!stationAllowed) {
    throw new Error("Station is not available for this account.");
  }

  const formats = normalizeReportFormats(input.formats);
  const facts = await collectReportFacts({
    tenantId: input.tenantId,
    templateKey: input.templateKey,
    stationId: input.stationId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    accessibleStations: input.accessibleStations,
  });

  const narrativeResult = await buildReportNarrative(facts, Boolean(input.includeAiCommentary));

  const run = await prisma.reportRun.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId ?? null,
      templateKey: input.templateKey,
      title: narrativeResult.narrative.title || template.title,
      audience: input.audience || template.defaultAudience,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      status: "GENERATING",
      formats: formats as Prisma.InputJsonValue,
      factsJson: asJson(facts),
      narrativeJson: asJson(narrativeResult.narrative),
      model: narrativeResult.model,
      usedOpenAi: narrativeResult.usedOpenAi,
      generatedBy: input.userId,
      sources: {
        create: facts.sources.map((source) => ({
          tenantId: input.tenantId,
          sourceType: source.sourceType,
          sourceId: source.sourceId ?? null,
          sourceLabel: source.sourceLabel ?? null,
          sourceSnapshot: source.sourceSnapshot ? asJson(source.sourceSnapshot) : undefined,
        })),
      },
    },
  });

  try {
    const artifacts = await renderReportArtifacts({
      reportId: run.id,
      tenantId: input.tenantId,
      narrative: narrativeResult.narrative,
      facts,
      formats,
    });

    await prisma.reportArtifact.createMany({
      data: artifacts.map((artifact) => ({
        tenantId: input.tenantId,
        reportRunId: run.id,
        format: artifact.format,
        filePath: artifact.filePath,
        fileSize: artifact.fileSize,
        checksum: artifact.checksum,
      })),
    });

    return prisma.reportRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED" },
      include: { artifacts: true, sources: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    await prisma.reportRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message },
    });
    throw error;
  }
}
