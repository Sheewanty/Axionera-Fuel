/**
 * Shared database client type for the FuelStation OS service layer.
 *
 * SERVICE LAYER CONTRACT
 * ──────────────────────
 * All service functions that perform WRITES must accept a `db: Db` parameter.
 * This allows them to participate in a Prisma interactive transaction opened
 * by withMutation() / withApproval(), guaranteeing that the domain write and
 * its audit log entry are atomic.
 *
 * Read-only service functions may omit `db` — they always use the singleton.
 *
 * Correct write service signature:
 *
 *   import type { Db } from "@/lib/db/types";
 *
 *   export async function createPumpReading(
 *     tenantId: string,
 *     data: PumpReadingInput,
 *     db: Db,              // ← required for writes, provided by withMutation
 *   ): Promise<PumpReading> {
 *     return db.pumpReading.create({ data: { tenantId, ...data } });
 *   }
 *
 * NEVER default `db` to the global `prisma` singleton in write functions.
 * Defaulting to global Prisma defeats the transaction guarantee — the write
 * would commit outside the transaction even if the audit log write fails.
 *
 * WHY THIS TYPE?
 * ──────────────
 * Prisma's interactive transaction passes a `tx` client typed as:
 *   Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
 *
 * The raw PrismaClient is assignable to this type, so a `Db`-typed parameter
 * accepts both the singleton (for standalone use) and the tx client (for
 * transactional use). We avoid importing private `runtime.ITXClientDenyList`
 * to stay decoupled from Prisma internals.
 */
import type { PrismaClient } from "@prisma/client";

export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
