import type { Expenditure } from "@prisma/client";
import type { Db } from "./types";
import type { CreateExpenditureInput, UpdateExpenditureInput } from "../schemas/expenditure.schema";
import { appendCorrectionNote } from "../corrections";

type TenantScopedInput = {
  tenantId: string;
};

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

async function assertStationAccess(db: Db, tenantId: string, stationId: string) {
  const station = await db.station.findFirst({
    where: { id: stationId, tenantId },
    select: { id: true },
  });

  if (!station) {
    throw new Error("Station not found or tenant mismatch");
  }
}

async function getWritableSession(db: Db, tenantId: string, stationId: string, dailySessionId: string) {
  const session = await db.dailySession.findUnique({
    where: { id: dailySessionId },
  });

  if (!session || session.tenantId !== tenantId || session.stationId !== stationId) {
    throw new Error("Daily session not found or mismatch");
  }

  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify expenditure for a session that is ${session.status}`);
  }

  return session;
}

export type CreateExpenditureServiceInput = CreateExpenditureInput & TenantScopedInput & {
  createdBy: string;
};

export async function createExpenditure(
  db: Db,
  input: CreateExpenditureServiceInput
): Promise<Expenditure> {
  const session = input.dailySessionId
    ? await getWritableSession(db, input.tenantId, input.stationId, input.dailySessionId)
    : null;

  if (!session) {
    await assertStationAccess(db, input.tenantId, input.stationId);
  }

  return db.expenditure.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId ?? null,
      businessDate: session?.businessDate ?? new Date(),
      voucherReference: input.voucherReference,
      category: input.category,
      amount: input.amount,
      paymentToBank: 0,
      paidBy: input.paidBy,
      approvedBy: input.approvedBy,
      receiptAttached: input.receiptAttached,
      description: input.description,
      createdBy: input.createdBy,
    },
  });
}

export type UpdateExpenditureServiceInput = UpdateExpenditureInput & TenantScopedInput & {
  updatedBy: string;
};

export async function updateExpenditure(
  db: Db,
  input: UpdateExpenditureServiceInput
): Promise<Expenditure> {
  const existing = await db.expenditure.findUnique({
    where: { id: input.id },
  });

  if (!existing || existing.tenantId !== input.tenantId || existing.stationId !== input.stationId) {
    throw new Error("Expenditure not found or tenant mismatch");
  }

  if ((existing.dailySessionId ?? undefined) !== input.dailySessionId) {
    throw new Error("Expenditure daily session cannot be changed after creation");
  }

  if (existing.dailySessionId) {
    await getWritableSession(db, input.tenantId, input.stationId, existing.dailySessionId);
  }

  return db.expenditure.update({
    where: { id: input.id },
    data: {
      voucherReference: input.voucherReference,
      category: input.category,
      amount: input.amount,
      paymentToBank: 0,
      paidBy: input.paidBy,
      approvedBy: input.approvedBy,
      receiptAttached: input.receiptAttached,
      description: appendCorrectionNote(input.description ?? existing.description, input.correctionReason),
      updatedBy: input.updatedBy,
    },
  });
}

export async function deleteExpenditure(
  db: Db,
  id: string,
  tenantId: string,
  stationId: string,
  dailySessionId?: string
): Promise<Expenditure> {
  const existing = await db.expenditure.findUnique({
    where: { id },
  });

  if (!existing || existing.tenantId !== tenantId || existing.stationId !== stationId) {
    throw new Error("Expenditure not found or tenant mismatch");
  }

  if ((existing.dailySessionId ?? undefined) !== dailySessionId) {
    throw new Error("Expenditure daily session mismatch");
  }

  if (existing.dailySessionId) {
    await getWritableSession(db, tenantId, stationId, existing.dailySessionId);
  }

  return db.expenditure.delete({
    where: { id },
  });
}

export async function listExpenditures(
  db: Db,
  tenantId: string,
  stationId: string,
  dailySessionId?: string
): Promise<Expenditure[]> {
  return db.expenditure.findMany({
    where: {
      tenantId,
      stationId,
      OR: [
        ...(dailySessionId ? [{ dailySessionId }] : []),
        { dailySessionId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}
