import PageTitle from "@/components/ui/PageTitle";
import { getRequiredSession, requireRole } from "@/lib/session";
import { getAccessibleStations } from "@/lib/db/station.service";
import ReportsHubClient from "./ReportsHubClient";

export default async function ReportsHubPage() {
  const session = await getRequiredSession();
  requireRole(session, ["OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "AUDITOR"]);

  let stations: { id: string; name: string }[] = [];
  try {
    stations = await getAccessibleStations(
      session.user.tenantId,
      session.user.membershipStationId
    );
  } catch {
    // DB not connected in dev — fall back to empty
  }

  return (
    <>
      <PageTitle
        eyebrow="Reports"
        title="Reports Hub"
        subtitle="Select a report category or generate a report from a template."
      />
      <ReportsHubClient stations={stations} />
    </>
  );
}
