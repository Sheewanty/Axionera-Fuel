import { AuthSession } from "./session";
import { getAccessibleStations } from "./db/station.service";
import { redirect } from "next/navigation";

/**
 * Appends a stationId query parameter to an href if the item is stationScoped.
 */
export function withStationParam(href: string, stationId: string | null, stationScoped: boolean = false): string {
  if (!stationScoped || !stationId) return href;
  
  // Basic URL parsing to handle existing search params
  try {
    const url = new URL(href, "http://dummy.local");
    url.searchParams.set("stationId", stationId);
    return `${url.pathname}${url.search}`;
  } catch {
    // Fallback if href is somehow unparseable
    const separator = href.includes("?") ? "&" : "?";
    return `${href}${separator}stationId=${stationId}`;
  }
}

/**
 * Ensures a stationId is present. If missing, attempts to find a fallback
 * and redirects to the same pathname with the fallback stationId.
 * Returns the resolved stationId, or null if the user has no accessible stations.
 */
export async function resolveOrRedirectStation(
  session: AuthSession,
  currentStationId: string | undefined,
  pathname: string
): Promise<string | null> {
  if (currentStationId) return currentStationId;

  const stations = await getAccessibleStations(session.user.tenantId, session.user.membershipStationId);
  const activeStation = session.user.activeStationId
    ? stations.find((station) => station.id === session.user.activeStationId)
    : undefined;
  const fallback = activeStation?.id ?? stations[0]?.id;
  
  if (fallback) {
    redirect(`${pathname}?stationId=${fallback}`);
  }
  
  return null;
}
