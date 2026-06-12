/**
 * withMutation / withApproval — canonical Server Action pipeline.
 *
 * Every domain mutation in FuelStation OS MUST be wrapped with one of these
 * helpers. They enforce a consistent, ordered security + audit pipeline:
 *
 *   1. getRequiredSession()         — identifies the caller (redirects if no session)
 *   2. requireWriteAccess()         — JWT role check + live DB re-check + station scope
 *      requireApproveAccess()       — same as above, but requires APPROVE_ROLES
 *   3. prisma.$transaction(async (tx) => {
 *        fn(session, tx, ...args)   — domain logic (uses tx, never global prisma)
 *        writeAuditLog({...}, tx)   — audit write inside the same transaction
 *      })
 *
 * ATOMICITY GUARANTEE
 * ───────────────────
 * The domain write and audit write share one transaction. Either both commit
 * or both roll back. There is no state where a mutation succeeds without an
 * audit row, or where an audit failure leaves orphaned domain state.
 *
 * Access checks (steps 1 & 2) run BEFORE the transaction opens. Auth should
 * never hold a DB connection open.
 *
 * The audit log is SKIPPED only if the access check fails — a denied request
 * never reaches the domain function.
 *
 * DOMAIN FUNCTION CONTRACT
 * ────────────────────────
 * `fn` receives the transaction client `db` as its SECOND argument (after
 * `session`). It MUST pass `db` to every service call it makes. Never use
 * the global `prisma` singleton inside `fn`.
 *
 * Usage (withMutation):
 *   export const savePumpReading = withMutation(
 *     {
 *       entityType: "PumpReading",
 *       action: "CREATE",
 *       getStationId: (data) => data.stationId,
 *       getEntityId:  (result) => result.id,
 *     },
 *     async (session, db, data: PumpReadingInput) => {
 *       //                ^^^ transaction client — pass to every service call
 *       return pumpReadingService.create(session.user.tenantId, data, db);
 *     }
 *   );
 *
 * Usage (withApproval):
 *   export const approveDailySession = withApproval(
 *     {
 *       entityType: "DailySession",
 *       action: "APPROVE",
 *       getStationId: (id) => undefined,
 *       getEntityId:  (result) => result.id,
 *     },
 *     async (session, db, id: string) => {
 *       return dailySessionService.approve(session.user.tenantId, id, db);
 *     }
 *   );
 */
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession, requireWriteAccess, requireApproveAccess, requireRole } from "@/lib/session";
import { writeAuditLog, type AuditAction } from "@/lib/db/audit.service";
import { type Role } from "@/lib/nav-config";
import type { Db } from "@/lib/db/types";
import type { AuthSession } from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MutationOpts<TArgs extends unknown[], TReturn> {
  /** Prisma model name (PascalCase). e.g. "PumpReading" */
  entityType: string;
  /** One of the five valid audit actions. */
  action: AuditAction;
  /**
   * Extract the target station ID from the action arguments.
   * Return undefined for tenant-wide mutations (no station scope check).
   * Required to enforce station-scoped access control.
   */
  getStationId?: (...args: TArgs) => string | undefined;
  /**
   * Extract the entity ID from the mutation result.
   * Used for the audit log entityId field.
   * If not provided, "unknown" is used (acceptable when the entity ID is not
   * available from the result type — e.g. DELETE operations).
   */
  getEntityId?: (result: TReturn) => string;
  /**
   * Extract a before-state snapshot from the action arguments.
   * For UPDATE/DELETE: pass the record before mutation.
   * For CREATE: omit or return null.
   */
  getBefore?: (...args: TArgs) => object | null | undefined;
  /**
   * Extract an after-state snapshot from the mutation result.
   * For CREATE/UPDATE: pass the record after mutation.
   * For DELETE: omit or return null.
   */
  getAfter?: (result: TReturn) => object | null | undefined;
  /**
   * Optional array of Roles allowed to perform this mutation.
   * If provided, the user's role is checked before the transaction begins.
   */
  roles?: Role[];
}

// ─── withMutation ─────────────────────────────────────────────────────────────

/**
 * Wraps a Server Action with: session → requireWriteAccess → $transaction(fn + audit).
 *
 * The returned function has the same signature as `fn` minus the session and
 * db arguments (both are resolved internally).
 */
export function withMutation<TArgs extends unknown[], TReturn>(
  opts: MutationOpts<TArgs, TReturn>,
  fn: (session: AuthSession, db: Db, ...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // 1. Identify the caller (redirects to /login if no session)
    const session = await getRequiredSession();

    // 1.5 Enforce explicit role authorization if specified
    if (opts.roles && opts.roles.length > 0) {
      requireRole(session, opts.roles);
    }

    // 2. Enforce write access — JWT check + live DB re-check + station scope.
    //    Runs BEFORE the transaction so auth never holds a connection open.
    const stationId = opts.getStationId?.(...args);
    await requireWriteAccess(session, { targetStationId: stationId });

    // 3. Domain write + audit write inside one transaction.
    //    If fn throws → transaction rolls back, audit never written.
    //    If writeAuditLog throws → transaction rolls back, domain write undone.
    return prisma.$transaction(async (tx) => {
      const result = await fn(session, tx, ...args);

      await writeAuditLog(
        {
          tenantId: session.user.tenantId,
          stationId: stationId ?? null,
          actorUserId: session.user.id,
          entityType: opts.entityType,
          entityId: opts.getEntityId?.(result) ?? "unknown",
          action: opts.action,
          before: opts.getBefore?.(...args) ?? null,
          after: opts.getAfter?.(result) ?? null,
        },
        tx  // ← same transaction client — both writes are atomic
      );

      return result;
    });
  };
}

// ─── withApproval ─────────────────────────────────────────────────────────────

/**
 * Wraps a Server Action with: session → requireApproveAccess → $transaction(fn + audit).
 *
 * Identical to withMutation but uses requireApproveAccess, which additionally
 * enforces APPROVE_ROLES (OWNER, ADMIN, STATION_MANAGER only).
 */
export function withApproval<TArgs extends unknown[], TReturn>(
  opts: MutationOpts<TArgs, TReturn>,
  fn: (session: AuthSession, db: Db, ...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // 1. Identify the caller
    const session = await getRequiredSession();

    // 2. Enforce approve access (APPROVE_ROLES + DB re-check + station scope)
    const stationId = opts.getStationId?.(...args);
    await requireApproveAccess(session, { targetStationId: stationId });

    // 3. Domain write + audit write — atomic transaction
    return prisma.$transaction(async (tx) => {
      const result = await fn(session, tx, ...args);

      await writeAuditLog(
        {
          tenantId: session.user.tenantId,
          stationId: stationId ?? null,
          actorUserId: session.user.id,
          entityType: opts.entityType,
          entityId: opts.getEntityId?.(result) ?? "unknown",
          action: opts.action,
          before: opts.getBefore?.(...args) ?? null,
          after: opts.getAfter?.(result) ?? null,
        },
        tx
      );

      return result;
    });
  };
}
