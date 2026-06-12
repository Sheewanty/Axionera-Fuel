/**
 * Membership service — tenant-scoped DB queries.
 *
 * ISOLATION CONTRACT: Every query in this file MUST include `tenantId` in
 * its `where` clause. The service layer is the authoritative enforcement point
 * for tenant isolation. No caller may bypass this by passing raw Prisma calls.
 *
 * SENTINEL: Membership.stationId = "" means a tenant-wide role (OWNER, ADMIN,
 * ACCOUNTANT, AUDITOR). Station-scoped roles store the real station cuid.
 *
 * SERVICE LAYER CONTRACT (for future write functions added to this file):
 * Write functions MUST accept `db: Db` (from "@/lib/db/types") — NOT optional,
 * NOT defaulting to global prisma. This ensures they run inside the transaction
 * opened by withMutation() / withApproval(). Read-only functions like those
 * below do not need db.
 */
import { prisma } from "@/lib/db/prisma";

export interface MembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  stationId: string; // "" = tenant-wide
  role: string;
}

/**
 * Finds the primary membership for a user within a specific tenant.
 * Returns null if the user has no membership in that tenant.
 *
 * Tenant-wide roles have stationId = "" — this is the expected record for
 * OWNER, ADMIN, ACCOUNTANT, AUDITOR.
 */
export async function getMembership(
  userId: string,
  tenantId: string
): Promise<MembershipRecord | null> {
  return prisma.membership.findFirst({
    where: { userId, tenantId },
    select: { id: true, tenantId: true, userId: true, stationId: true, role: true },
  });
}

/**
 * Returns all station-scoped memberships for a user (excludes tenant-wide "").
 * Used to determine which stations a SUPERVISOR or ATTENDANT can access.
 *
 * @throws Never — returns empty array if none found.
 */
export async function getStationMemberships(
  userId: string,
  tenantId: string
): Promise<MembershipRecord[]> {
  return prisma.membership.findMany({
    where: {
      userId,
      tenantId,
      NOT: { stationId: "" }, // exclude tenant-wide sentinel
    },
    select: { id: true, tenantId: true, userId: true, stationId: true, role: true },
  });
}

/**
 * Verifies that the given membership (identified by composite key) still
 * exists in the DB and has the expected role. Used by requireWriteAccess()
 * to detect revocation between JWT issuance and the current request.
 *
 * Returns the membership if valid, null if revoked or role changed.
 */
export async function verifyMembershipFresh(
  tenantId: string,
  userId: string,
  stationId: string, // use "" for tenant-wide
  expectedRole: string
): Promise<MembershipRecord | null> {
  const m = await prisma.membership.findUnique({
    where: {
      tenantId_userId_stationId: { tenantId, userId, stationId },
    },
    select: { id: true, tenantId: true, userId: true, stationId: true, role: true },
  });
  if (!m || m.role !== expectedRole) return null;
  return m;
}

/**
 * Asserts that a user's stationId claim gives access to the target station.
 *
 * Rules:
 *  - Tenant-wide (membershipStationId = "") → can access any station in the tenant
 *  - Station-scoped (membershipStationId = cuid) → can only access that one station
 *
 * @throws Error if access is denied (caller should convert to HTTP 403)
 */
export function assertStationAccess(
  membershipStationId: string,
  targetStationId: string
): void {
  // Sentinel "" must never appear as a real target station id — always check first
  if (targetStationId === "") {
    throw new Error("Sentinel stationId cannot be used as a real station identifier");
  }
  if (membershipStationId === "") return; // tenant-wide: allowed for any real station
  if (membershipStationId === targetStationId) return; // own station: allowed
  throw new Error(
    `Station access denied: membership covers ${membershipStationId}, requested ${targetStationId}`
  );
}
