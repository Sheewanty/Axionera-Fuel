import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { getAccessibleStations } from "@/lib/db/station.service";
import { formatReportDate } from "@/lib/reports";
import { listReportRuns } from "@/lib/reporting/report-query.service";
import { getRequiredSession, requireRole } from "@/lib/session";
import ReportLibraryClient from "./ReportLibraryClient";
import type { ReportRunRow } from "./ReportLibraryClient";

export default async function ReportLibraryPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  const [runs, stations, users] = await Promise.all([
    listReportRuns(session.user.tenantId, session.user.membershipStationId),
    getAccessibleStations(session.user.tenantId, session.user.membershipStationId),
    prisma.user.findMany({
      where: { memberships: { some: { tenantId: session.user.tenantId } } },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const stationNames = new Map(stations.map((s) => [s.id, s.name]));
  const userNames = new Map(users.map((u) => [u.id, u.name || u.email || "User"]));

  const reports: ReportRunRow[] = runs.map((run) => ({
    id: run.id,
    title: run.title,
    templateKey: run.templateKey,
    stationId: run.stationId,
    stationName: run.stationId ? stationNames.get(run.stationId) ?? "Station" : null,
    periodFrom: formatReportDate(run.periodFrom),
    periodTo: formatReportDate(run.periodTo),
    generatedByName: userNames.get(run.generatedBy) ?? "User",
    createdAt: formatReportDate(run.createdAt),
    status: run.status,
    usedOpenAi: run.usedOpenAi,
    audience: run.audience,
    artifacts: run.artifacts.map((a) => ({
      id: a.id,
      format: a.format,
      fileSize: a.fileSize,
      downloadUrl: `/api/reports/${run.id}/download/${a.format.toLowerCase()}`,
    })),
  }));

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Report Library"
        subtitle="Generated PDF and PPTX reports for this tenant."
      />
      <ReportLibraryClient reports={reports} stations={stations} />
    </>
  );
}
