import { prisma } from "@/lib/db/prisma";

export function reportRunScope(tenantId: string, membershipStationId: string) {
  return membershipStationId === ""
    ? { tenantId }
    : { tenantId, stationId: membershipStationId };
}

export async function listReportRuns(tenantId: string, membershipStationId: string, limit = 50) {
  return prisma.reportRun.findMany({
    where: reportRunScope(tenantId, membershipStationId),
    include: { artifacts: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getReportRunForTenant(tenantId: string, membershipStationId: string, reportRunId: string) {
  return prisma.reportRun.findFirst({
    where: { id: reportRunId, ...reportRunScope(tenantId, membershipStationId) },
    include: { artifacts: true, sources: true },
  });
}

export async function getReportArtifactForTenant(
  tenantId: string,
  membershipStationId: string,
  reportRunId: string,
  format: string
) {
  return prisma.reportArtifact.findFirst({
    where: {
      tenantId,
      reportRunId,
      format: format.toUpperCase(),
      reportRun: reportRunScope(tenantId, membershipStationId),
    },
  });
}
