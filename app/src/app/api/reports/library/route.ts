import { NextResponse } from "next/server";
import { listReportRuns } from "@/lib/reporting/report-query.service";
import { getRequiredSession, requireRole } from "@/lib/session";

export async function GET() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const runs = await listReportRuns(session.user.tenantId, session.user.membershipStationId);

  return NextResponse.json({
    reports: runs.map((run) => ({
      id: run.id,
      templateKey: run.templateKey,
      title: run.title,
      audience: run.audience,
      stationId: run.stationId,
      periodFrom: run.periodFrom,
      periodTo: run.periodTo,
      status: run.status,
      usedOpenAi: run.usedOpenAi,
      model: run.model,
      error: run.error,
      createdAt: run.createdAt,
      artifacts: run.artifacts.map((artifact) => ({
        id: artifact.id,
        format: artifact.format,
        fileSize: artifact.fileSize,
        checksum: artifact.checksum,
        downloadUrl: `/api/reports/${run.id}/download/${artifact.format.toLowerCase()}`,
      })),
    })),
  });
}
