/**
 * Audit log service — FuelStation OS.
 *
 * RULES:
 *  - Every successful mutation (create/update/delete/approve/reopen) MUST
 *    call writeAuditLog() BEFORE returning success to the caller.
 *  - writeAuditLog() is always awaited — we do not use fire-and-forget.
 *    Compliance requires the audit record to be persisted before the
 *    mutation response is returned to the client.
 *  - If an audit write fails, the error is re-thrown. Callers
 *    (withMutation / withApproval) must handle this appropriately.
 *  - tenantId is ALWAYS required — no cross-tenant audit rows possible.
 */
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The five valid audit actions.
 * Matches the comment in prisma/schema.prisma AuditLog.action.
 * Using a union type (not a Prisma enum) so the schema stays flexible.
 */
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REOPEN";

export interface AuditParams {
  /** Always required — enforces tenant isolation at the audit layer. */
  tenantId: string;
  /** Optional — tenant-level actions (e.g. user management) have no station context. */
  stationId?: string | null;
  /** ID of the authenticated user who performed the action. */
  actorUserId: string;
  /**
   * Prisma model name (PascalCase, matches schema).
   * Examples: "PumpReading", "TankDipping", "DailySession", "CashEntry"
   */
  entityType: string;
  /** Primary key (cuid) of the record being mutated. */
  entityId: string;
  /** One of the five valid audit actions. */
  action: AuditAction;
  /**
   * Snapshot of the record BEFORE the mutation.
   * null for CREATE (no prior state exists).
   */
  before?: object | null;
  /**
   * Snapshot of the record AFTER the mutation.
   * null for DELETE (record no longer exists).
   */
  after?: object | null;
}

// ─── Service function ─────────────────────────────────────────────────────────

/**
 * Writes a single audit log entry.
 *
 * Always awaited — never fire-and-forget.
 * If the write fails (e.g. DB down), the error propagates to the caller.
 *
 * @param db - Optional Prisma client. When provided (by withMutation / withApproval),
 *             the write runs inside the caller's transaction. When omitted, uses the
 *             global singleton (standalone use only — avoid in mutation paths).
 *
 * @throws Prisma errors (network, constraint) — caller should handle.
 */
export async function writeAuditLog(params: AuditParams, db?: Db): Promise<void> {
  const {
    tenantId,
    stationId = null,
    actorUserId,
    entityType,
    entityId,
    action,
    before = null,
    after = null,
  } = params;

  await (db ?? prisma).auditLog.create({
    data: {
      tenantId,
      stationId,
      actorUserId,
      entityType,
      entityId,
      action,
      beforeJson: before ?? undefined,
      afterJson: after ?? undefined,
    },
  });
}
