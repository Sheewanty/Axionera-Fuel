import { CashCollection, Prisma } from "@prisma/client";
import { Db } from "./types";
import { CashCollectionInput, CorrectCashCollectionInput } from "../schemas/cash-collection.schema";
import { calcPhysicalCashToBank, calcCashCollectionVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

async function getTotalCreditorPayments(tenantId: string, dailySessionId: string, db: Db): Promise<number> {
  const creditorPayments = await db.creditorLedgerEntry.findMany({
    where: {
      tenantId,
      dailySessionId,
      type: "PAYMENT",
    },
    select: { amount: true },
  });

  return creditorPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export async function createCashCollection(
  tenantId: string,
  actorUserId: string,
  input: CashCollectionInput,
  db: Db
): Promise<CashCollection> {
  // Enforce tenant isolation on the session and station
  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });
  if (!session || session.tenantId !== tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify cash collection for a session that is ${session.status}`);
  }

  // Calculate total cash received from pump readings for this session
  const pumpReadings = await db.pumpReading.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { cashReceived: true },
  });
  const totalPumpCashReceived = pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);
  const totalCreditorPayments = await getTotalCreditorPayments(tenantId, input.dailySessionId, db);
  const totalCashReceived = totalPumpCashReceived + totalCreditorPayments;

  // Expenditure is now recorded as the actual spent amount only.
  const expenditures = await db.expenditure.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { amount: true },
  });
  const totalNetExpenditure = expenditures.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const duplicate = await db.cashCollection.findFirst({
    where: {
      tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      amountToBank: input.amountToBank,
      bankCollectionDate: input.bankCollectionDate ? new Date(input.bankCollectionDate) : null,
      bankCollectionReference: input.bankCollectionReference || null,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("This cash collection appears to have already been recorded.");
  }

  // Fetch previous cash collections for this session to compute remaining expected cash
  const previousCollections = await db.cashCollection.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { amountToBank: true },
  });
  const totalBankedSoFar = previousCollections.reduce((sum, c) => sum + Number(c.amountToBank), 0);

  const baseExpectedCash = calcPhysicalCashToBank(totalCashReceived, totalNetExpenditure);
  const expectedCashRemaining = baseExpectedCash - totalBankedSoFar;
  const variance = calcCashCollectionVariance(input.amountToBank, expectedCashRemaining);

  const data: Prisma.CashCollectionCreateInput = {
    tenantId,
    amountToBank: input.amountToBank,
    bankCollectionDate: input.bankCollectionDate ? new Date(input.bankCollectionDate) : null,
    bankCollectionReference: input.bankCollectionReference || null,
    expectedCash: expectedCashRemaining,
    variance,
    bankSignatureName: input.bankSignatureName || null,
    supervisorSignatureName: input.supervisorSignatureName || null,
    remarks: input.remarks || null,
    createdBy: actorUserId,
    businessDate: new Date(input.businessDate),
    station: { connect: { id: input.stationId } },
    dailySession: { connect: { id: input.dailySessionId } },
  };

  return db.cashCollection.create({ data });
}

export async function correctCashCollection(
  tenantId: string,
  actorUserId: string,
  input: CorrectCashCollectionInput,
  db: Db
): Promise<CashCollection> {
  const existing = await db.cashCollection.findUnique({
    where: { id: input.id },
  });
  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.stationId !== input.stationId ||
    existing.dailySessionId !== input.dailySessionId
  ) {
    throw new Error("Cash collection not found or mismatch");
  }

  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });
  if (!session || session.tenantId !== tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify cash collection for a session that is ${session.status}`);
  }

  const pumpReadings = await db.pumpReading.findMany({
    where: { tenantId, dailySessionId: input.dailySessionId },
    select: { cashReceived: true },
  });
  const totalPumpCashReceived = pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);
  const totalCreditorPayments = await getTotalCreditorPayments(tenantId, input.dailySessionId, db);
  const totalCashReceived = totalPumpCashReceived + totalCreditorPayments;

  const expenditures = await db.expenditure.findMany({
    where: { tenantId, dailySessionId: input.dailySessionId },
    select: { amount: true },
  });
  const totalNetExpenditure = expenditures.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const duplicate = await db.cashCollection.findFirst({
    where: {
      tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      id: { not: input.id },
      amountToBank: input.amountToBank,
      bankCollectionDate: input.bankCollectionDate ? new Date(input.bankCollectionDate) : null,
      bankCollectionReference: input.bankCollectionReference || null,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("This cash collection appears to duplicate an existing record.");
  }

  const otherCollections = await db.cashCollection.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
      id: { not: input.id },
    },
    select: { amountToBank: true },
  });
  const totalBankedExcludingThis = otherCollections.reduce((sum, c) => sum + Number(c.amountToBank), 0);

  const baseExpectedCash = calcPhysicalCashToBank(totalCashReceived, totalNetExpenditure);
  const expectedCashRemaining = baseExpectedCash - totalBankedExcludingThis;
  const variance = calcCashCollectionVariance(input.amountToBank, expectedCashRemaining);

  return db.cashCollection.update({
    where: { id: input.id },
    data: {
      amountToBank: input.amountToBank,
      bankCollectionDate: input.bankCollectionDate ? new Date(input.bankCollectionDate) : null,
      bankCollectionReference: input.bankCollectionReference || null,
      expectedCash: expectedCashRemaining,
      variance,
      bankSignatureName: input.bankSignatureName || null,
      supervisorSignatureName: input.supervisorSignatureName || null,
      remarks: appendCorrectionNote(input.remarks || existing.remarks, input.correctionReason),
      updatedBy: actorUserId,
    },
  });
}

export async function listCashCollections(
  tenantId: string,
  dailySessionId: string,
  db: Db
): Promise<CashCollection[]> {
  return db.cashCollection.findMany({
    where: {
      tenantId,
      dailySessionId,
    },
    orderBy: { createdAt: "asc" },
  });
}
