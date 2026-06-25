import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentBusinessDate } from "@/lib/business-date";
import { getAccessibleStations } from "@/lib/db/station.service";
import { resolveReportStationId } from "@/lib/reporting/report-access";
import { generateReportRun } from "@/lib/reporting/report-generation.service";
import { getReportTemplate, normalizeReportFormats, type ReportTemplateKey } from "@/lib/reporting/report-templates";
import { getRequiredSession, requireRole } from "@/lib/session";

export const runtime = "nodejs";

const generateReportSchema = z.object({
  templateKey: z.string().min(1),
  stationId: z.string().optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  formats: z.array(z.string()).optional(),
  audience: z.string().trim().max(80).optional(),
  includeAiCommentary: z.boolean().optional(),
});

function parseDate(value: string | undefined): Date {
  const source = value || currentBusinessDate();
  const date = new Date(`${source}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid report date: ${source}`);
  }
  return date;
}

export async function POST(request: NextRequest) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "ACCOUNTANT"]);

  try {
    const parsed = generateReportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid report request.",
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const template = getReportTemplate(parsed.data.templateKey);
    if (!template) {
      return NextResponse.json({ message: "Unknown report template." }, { status: 400 });
    }

    const accessibleStations = await getAccessibleStations(session.user.tenantId, session.user.membershipStationId);
    const stationId = resolveReportStationId({
      requestedStationId: parsed.data.stationId,
      membershipStationId: session.user.membershipStationId,
      templateStationScoped: template.stationScoped,
    });

    const run = await generateReportRun({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      templateKey: template.key as ReportTemplateKey,
      stationId,
      periodFrom: parseDate(parsed.data.periodFrom),
      periodTo: parseDate(parsed.data.periodTo),
      formats: normalizeReportFormats(parsed.data.formats),
      audience: parsed.data.audience || template.defaultAudience,
      includeAiCommentary: parsed.data.includeAiCommentary,
      accessibleStations,
    });

    return NextResponse.json({
      report: {
        id: run.id,
        title: run.title,
        status: run.status,
        usedOpenAi: run.usedOpenAi,
        artifacts: run.artifacts.map((artifact) => ({
          format: artifact.format,
          fileSize: artifact.fileSize,
          downloadUrl: `/api/reports/${run.id}/download/${artifact.format.toLowerCase()}`,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
