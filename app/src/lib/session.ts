/**
 * Server-side session helpers for FuelStation OS.
 *
 * These functions run in the Node.js runtime (Server Components, Server Actions,
 * Route Handlers). Do not import in client components or middleware.
 *
 * SECURITY LAYERS:
 *  1. Middleware (Edge) — auth-only gate: authenticated vs not
 *  2. getRequiredSession() — Server Component identity check
 *  3. requireRole() — role validation (fast, JWT-based)
 *  4. requireWriteAccess() / requireApproveAccess() — DB re-check for mutations
 *     Catches revoked memberships and role changes within the 30-min JWT window.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { verifyMembershipFresh } from "@/lib/db/membership.service";
import type { Role, AccessLevel } from "@/lib/nav-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthSession = Session & {
  user: {
    id: string;
    tenantId: string;
    role: string;
    membershipStationId: string;
    activeStationId: string | null;
    forcePasswordChange: boolean;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

// ─── Role permission sets (mirrors nav-config.ts) ────────────────────────────

/** Roles that may create or edit records */
const WRITE_ROLES: ReadonlySet<string> = new Set([
  "OWNER", "ADMIN", "STATION_MANAGER", "SUPERVISOR", "ATTENDANT",
]);

/** Roles that may approve or sign off daily sessions */
const APPROVE_ROLES: ReadonlySet<string> = new Set(["OWNER", "ADMIN", "STATION_MANAGER"]);

export function canWrite(role: string): boolean {
  return WRITE_ROLES.has(role);
}

export function canApprove(role: string): boolean {
  return APPROVE_ROLES.has(role);
}

// ─── Session getters ──────────────────────────────────────────────────────────

/**
 * Returns the current session. Redirects to /login if not authenticated.
 * Use this in all authenticated Server Components and layouts.
 */
export async function getRequiredSession(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session as AuthSession;
}

/**
 * Returns the current session or null (does not redirect).
 * Use this in components that render differently for authenticated users.
 */
export async function getSession(): Promise<AuthSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session as AuthSession;
}

// ─── Role guards ──────────────────────────────────────────────────────────────

/**
 * Asserts the session role is in the allowed set.
 * Throws AccessDeniedError if not — caller converts to HTTP 403 or UI gate.
 *
 * NOTE: This is a JWT-based check (fast, no DB). Sufficient for read operations.
 * For writes/approvals, use requireWriteAccess() which also does a DB re-check.
 */
export function requireRole(session: AuthSession, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(session.user.role as Role)) {
    throw new AccessDeniedError(
      `Role '${session.user.role}' is not permitted. Required: ${allowedRoles.join(", ")}`
    );
  }
}

export function requireSuperAdmin(session: AuthSession): void {
  if (session.user.role !== "SUPER_ADMIN") {
    throw new AccessDeniedError("Super admin access required");
  }
}

/**
 * Asserts the session's access level for a given operation is sufficient.
 *
 * IMPORTANT: Only call this for write/approve operations.
 * "view" is read-only. "explicit_grant" is nav-only until a real
 * PermissionGrant model exists, so it fails closed on the server.
 *
 * Level mapping:
 *   "full"           → requires APPROVE_ROLES (OWNER, ADMIN, STATION_MANAGER)
 *   "entry"/"limited"→ requires WRITE_ROLES
 *   "view"           → no server enforcement (read-only, use requireRole for page guard)
 *   "explicit_grant" → throws; nav visibility only until PermissionGrant exists
 *   "none"           → always throws
 */
export function requireAccess(session: AuthSession, requiredLevel: AccessLevel): void {
  const role = session.user.role;

  if (requiredLevel === "none") {
    throw new AccessDeniedError("No access configured for this resource");
  }

  if (requiredLevel === "explicit_grant") {
    throw new AccessDeniedError(
      "Explicit grants require a server-side PermissionGrant check"
    );
  }

  if (requiredLevel === "view") {
    return;
  }

  if (requiredLevel === "full" && !APPROVE_ROLES.has(role)) {
    throw new AccessDeniedError("Full (approve) access required");
  }

  if ((requiredLevel === "entry" || requiredLevel === "limited") && !WRITE_ROLES.has(role)) {
    throw new AccessDeniedError("Write access required");
  }
}


// ─── Mutation guards (DB re-check) ───────────────────────────────────────────

/**
 * Guards write operations (create / update / delete).
 *
 * 1. Checks the JWT role allows writes (fast)
 * 2. Re-verifies the membership in the DB (catches revocations within the 30-min JWT window)
 * 3. If a targetStationId is provided, verifies station access scope
 *
 * Call this at the top of every Server Action that mutates data.
 *
 * @throws AccessDeniedError — caller should catch and return a 403 response or error state
 */
/**
 * Asserts a read-only page is allowed to show records for the requested station.
 *
 * Tenant-wide memberships use stationId sentinel "" and may read all stations
 * in their tenant. Station-scoped memberships may only read their own station.
 */
export function requireStationScope(session: AuthSession, targetStationId: string): void {
  if (!targetStationId || targetStationId === "") {
    throw new AccessDeniedError("A real stationId is required");
  }

  const membershipStationId = session.user.membershipStationId;
  if (membershipStationId !== "" && membershipStationId !== targetStationId) {
    throw new AccessDeniedError(
      `Station access denied: your membership covers station ${membershipStationId}`
    );
  }
}

export async function requireWriteAccess(
  session: AuthSession,
  opts: { targetStationId?: string } = {}
): Promise<void> {
  if (!canWrite(session.user.role)) {
    throw new AccessDeniedError(
      `Role '${session.user.role}' does not have write access`
    );
  }

  // DB re-check — confirms membership is still active with the same role
  const fresh = await verifyMembershipFresh(
    session.user.tenantId,
    session.user.id,
    session.user.membershipStationId,
    session.user.role
  );
  if (!fresh) {
    throw new AccessDeniedError(
      "Your membership has been revoked or changed. Please sign in again."
    );
  }

  // Station scope check — runs only when a target station was specified
  if (opts.targetStationId !== undefined) {
    // Sentinel "" must never be used as a real station target
    if (opts.targetStationId === "") {
      throw new AccessDeniedError("Sentinel stationId cannot be used as a target");
    }
    const membershipStationId = session.user.membershipStationId;
    if (membershipStationId !== "" && membershipStationId !== opts.targetStationId) {
      throw new AccessDeniedError(
        `Station access denied: your membership covers station ${membershipStationId}`
      );
    }
  }
}


/**
 * Guards approve/sign-off operations.
 * Same as requireWriteAccess but requires APPROVE_ROLES (OWNER, ADMIN, STATION_MANAGER).
 */
export async function requireApproveAccess(
  session: AuthSession,
  opts: { targetStationId?: string } = {}
): Promise<void> {
  if (!canApprove(session.user.role)) {
    throw new AccessDeniedError(
      `Role '${session.user.role}' does not have approve access`
    );
  }
  // Reuse write guard for DB re-check and station scope
  await requireWriteAccess(session, opts);
}
