import fsp from "node:fs/promises";
import { NextResponse } from "next/server";
import { getReportArtifactForTenant, getReportRunForTenant } from "@/lib/reporting/report-query.service";
import { getRequiredSession, requireRole } from "@/lib/session";

export const runtime = "nodejs";

type Params = Promise<{ reportId: string; format: string }>;

function contentType(format: string): string {
  if (format.toUpperCase() === "PDF") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const { reportId, format } = await params;
  const normalizedFormat = format.toUpperCase();

  if (normalizedFormat !== "PDF" && normalizedFormat !== "PPTX") {
    return NextResponse.json({ message: "Unsupported report format." }, { status: 400 });
  }

  const [run, artifact] = await Promise.all([
    getReportRunForTenant(session.user.tenantId, session.user.membershipStationId, reportId),
    getReportArtifactForTenant(session.user.tenantId, session.user.membershipStationId, reportId, normalizedFormat),
  ]);

  if (!run || !artifact) {
    return NextResponse.json({ message: "Report artifact not found." }, { status: 404 });
  }

  const buffer = await fsp.readFile(artifact.filePath);
  const filename = `${run.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${normalizedFormat.toLowerCase()}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType(normalizedFormat),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
