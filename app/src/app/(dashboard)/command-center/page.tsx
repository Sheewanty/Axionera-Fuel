import PageTitle from "@/components/ui/PageTitle";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate, formatDisplayDate } from "@/lib/business-date";
import { getRequiredSession, requireWriteAccess } from "@/lib/session";
import { resolveOrRedirectStation } from "@/lib/station-utils";
import CommandCenterClient from "./CommandCenterClient";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;
  const stationId = await resolveOrRedirectStation(session, params.stationId, "/command-center");

  if (!stationId) {
    return (
      <>
        <PageTitle eyebrow="Command Center" title="Station Dashboard" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            No stations available for this account.
          </div>
        </div>
      </>
    );
  }

  await requireWriteAccess(session, { targetStationId: stationId });

  const station = await prisma.station.findFirst({
    where: { id: stationId, tenantId: session.user.tenantId },
  });

  if (!station) {
    return (
      <>
        <PageTitle eyebrow="Command Center" title="Station Dashboard" />
        <div className="dash-panel">
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--ax-muted)" }}>
            Station not found.
          </div>
        </div>
      </>
    );
  }

  const dailySession = await prisma.dailySession.findFirst({
    where: {
      tenantId: session.user.tenantId,
      stationId,
      businessDate: currentBusinessDate(),
      shift: "DAY",
    },
  });

  return (
    <CommandCenterClient
      stationId={station.id}
      stationName={station.name}
      businessDate={formatDisplayDate(currentBusinessDate())}
      dailySessionStatus={dailySession?.status ?? null}
    />
  );
}
