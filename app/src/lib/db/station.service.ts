/**
 * Station service — tenant-scoped DB queries.
 *
 * ISOLATION CONTRACT: All queries scope by tenantId. Station-scoped users
 * receive only their permitted station. Tenant-wide users receive all stations
 * for the tenant.
 */
import { prisma } from "@/lib/db/prisma";

export interface StationSummary {
  id: string;
  name: string;
  code: string;
  location: string | null;
  status: string;
}

/**
 * Returns stations the user can access, scoped by their membership.
 *
 * - Tenant-wide (membershipStationId = "") → all active stations for the tenant
 * - Station-scoped (membershipStationId = cuid) → only that one station
 */
export async function getAccessibleStations(
  tenantId: string,
  membershipStationId: string
): Promise<StationSummary[]> {
  // Sentinel "" must never be queried as a station id
  const stationFilter =
    membershipStationId === ""
      ? { tenantId, status: "ACTIVE" }
      : { tenantId, id: membershipStationId, status: "ACTIVE" };

  return prisma.station.findMany({
    where: stationFilter,
    select: { id: true, name: true, code: true, location: true, status: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Returns a single station, asserting it belongs to the tenant.
 * Returns null if not found or belongs to a different tenant.
 *
 * Always use this instead of a bare `prisma.station.findUnique({ where: { id } })`
 * to prevent cross-tenant data leakage.
 */
export async function getStation(
  tenantId: string,
  stationId: string
): Promise<StationSummary | null> {
  if (!stationId || stationId === "") return null; // sentinel guard
  return prisma.station.findFirst({
    where: { id: stationId, tenantId },
    select: { id: true, name: true, code: true, location: true, status: true },
  });
}
