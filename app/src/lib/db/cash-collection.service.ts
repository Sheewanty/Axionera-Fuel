import { CashCollection, Prisma } from "@prisma/client";
import { Db } from "./types";
import { CashCollectionInput, CorrectCashCollectionInput, StationCashCollectionInput } from "../schemas/cash-collection.schema";
import { calcPhysicalCashToBank, calcCashCollectionVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";
import { currentBusinessDate } from "../business-date";

const LOCKED_SESSION_STATUSES = new Set(["APPROVED"]);
const MONEY_EPSILON = 0.005;

export type PendingCashSession = {
  dailySessionId: string;
  businessDate: Date;
  status: string;
  totalPumpCashReceived: number;
  totalDebtorCashReceived: number;
  totalLubeBayCashSales: number;
  totalNetExpenditure: number;
  totalBanked: number;
  remainingExpectedCash: number;
};

async function getTotalCreditorPayments(tenantId: string, dailySessionId: string, db: Db): Promise<number> {
  const creditorPayments = await db.creditorLedgerEntry.findMany({
    where: {
      tenantId,
      dailySessionId,
      type: "PAYMENT",
      paymentMethod: "CASH",
    },
    select: { amount: true },
  });

  return creditorPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export async function getPendingCashCollectionWindow(
  tenantId: string,
  stationId: string,
  db: Db
): Promise<PendingCashSession[]> {
  const sessions = await db.dailySession.findMany({
    where: {
      tenantId,
      stationId,
      status: { in: ["OPEN", "REOPENED", "READY_FOR_REVIEW"] },
    },
    include: {
      pumpReadings: { select: { cashReceived: true } },
      creditorLedger: {
        where: {
          type: "PAYMENT",
          paymentMethod: "CASH",
        },
        select: { amount: true },
      },
      lubeBaySales: { select: { cashAmount: true } },
      expenditures: { select: { amount: true } },
      cashCollections: { select: { amountToBank: true } },
    },
    orderBy: [{ businessDate: "asc" }, { openedAt: "asc" }],
  });

  return sessions
    .map((session) => {
      const totalPumpCashReceived = session.pumpReadings.reduce((sum, row) => sum + Number(row.cashReceived), 0);
      const totalDebtorCashReceived = session.creditorLedger.reduce((sum, row) => sum + Number(row.amount), 0);
      const totalLubeBayCashSales = session.lubeBaySales.reduce((sum, row) => sum + Number(row.cashAmount), 0);
      const totalNetExpenditure = session.expenditures.reduce((sum, row) => sum + Number(row.amount), 0);
      const totalBanked = session.cashCollections.reduce((sum, row) => sum + Number(row.amountToBank), 0);
      const expectedCash = calcPhysicalCashToBank(
        totalPumpCashReceived + totalDebtorCashReceived + totalLubeBayCashSales,
        totalNetExpenditure
      );

      return {
        dailySessionId: session.id,
        businessDate: session.businessDate,
        status: session.status,
        totalPumpCashReceived,
        totalDebtorCashReceived,
        totalLubeBayCashSales,
        totalNetExpenditure,
        totalBanked,
        remainingExpectedCash: expectedCash - totalBanked,
      };
    })
    .filter((session) => session.remainingExpectedCash > MONEY_EPSILON);
}

function assertNewCollectionWithinExpected(amountToBank: number, expectedCashRemaining: number) {
  if (expectedCashRemaining <= MONEY_EPSILON) {
    throw new Error("No remaining expected cash is available for banking. Correct existing cash entries before adding another one.");
  }

  if (amountToBank - expectedCashRemaining > MONEY_EPSILON) {
    throw new Error(`Amount to bank cannot exceed the remaining expected cash of GHS${expectedCashRemaining.toFixed(2)}.`);
  }
}

export async function createStationCashCollectionSweep(
  tenantId: string,
  actorUserId: string,
  input: StationCashCollectionInput,
  db: Db
): Promise<CashCollection[]> {
  const station = await db.station.findFirst({
    where: { id: input.stationId, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!station) {
    throw new Error("Station was not found for this company");
  }

  const bankCollectionDate = input.bankCollectionDate ? new Date(input.bankCollectionDate) : currentBusinessDate();
  const bankCollectionReference = input.bankCollectionReference || null;

  if (bankCollectionReference) {
    const duplicateReference = await db.cashCollection.findFirst({
      where: {
        tenantId,
        stationId: input.stationId,
        bankCollectionReference,
      },
      select: { id: true },
    });
    if (duplicateReference) {
      throw new Error("This bank collection reference has already been recorded for this station.");
    }
  }

  const pendingSessions = await getPendingCashCollectionWindow(tenantId, input.stationId, db);
  const totalExpectedCashRemaining = pendingSessions.reduce((sum, session) => sum + session.remainingExpectedCash, 0);
  assertNewCollectionWithinExpected(input.amountToBank, totalExpectedCashRemaining);

  let amountLeftToAllocate = input.amountToBank;
  const created: CashCollection[] = [];

  for (const session of pendingSessions) {
    if (amountLeftToAllocate <= MONEY_EPSILON) break;

    const amountForSession = Math.min(amountLeftToAllocate, session.remainingExpectedCash);
    if (amountForSession <= MONEY_EPSILON) continue;

    const variance = calcCashCollectionVariance(amountForSession, session.remainingExpectedCash);
    const data: Prisma.CashCollectionCreateInput = {
      tenantId,
      amountToBank: amountForSession,
      bankCollectionDate,
      bankCollectionReference,
      expectedCash: session.remainingExpectedCash,
      variance,
      bankSignatureName: input.bankSignatureName || null,
      supervisorSignatureName: input.supervisorSignatureName || null,
      remarks: input.remarks || null,
      createdBy: actorUserId,
      businessDate: session.businessDate,
      station: { connect: { id: input.stationId } },
      dailySession: { connect: { id: session.dailySessionId } },
    };

    created.push(await db.cashCollection.create({ data }));
    amountLeftToAllocate -= amountForSession;
  }

  return created;
}

function assertCorrectionWithinExpected(
  amountToBank: number,
  expectedCashRemaining: number,
  existingAmountToBank: number
) {
  if (amountToBank <= existingAmountToBank + MONEY_EPSILON) {
    return;
  }

  if (expectedCashRemaining <= MONEY_EPSILON) {
    throw new Error("No remaining expected cash is available. Reduce or correct existing cash entries before increasing this entry.");
  }

  if (amountToBank - expectedCashRemaining > MONEY_EPSILON) {
    throw new Error(`Corrected amount cannot exceed the remaining expected cash of GHS${expectedCashRemaining.toFixed(2)}.`);
  }
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
  const lubeBaySales = await db.lubeBaySale.findMany({
    where: { tenantId, dailySessionId: input.dailySessionId },
    select: { cashAmount: true },
  });
  const totalLubeBayCashSales = lubeBaySales.reduce((sum, sale) => sum + Number(sale.cashAmount), 0);
  const totalCashReceived = totalPumpCashReceived + totalCreditorPayments + totalLubeBayCashSales;

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
  assertNewCollectionWithinExpected(input.amountToBank, expectedCashRemaining);
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
  const lubeBaySales = await db.lubeBaySale.findMany({
    where: { tenantId, dailySessionId: input.dailySessionId },
    select: { cashAmount: true },
  });
  const totalLubeBayCashSales = lubeBaySales.reduce((sum, sale) => sum + Number(sale.cashAmount), 0);
  const totalCashReceived = totalPumpCashReceived + totalCreditorPayments + totalLubeBayCashSales;

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
  assertCorrectionWithinExpected(input.amountToBank, expectedCashRemaining, Number(existing.amountToBank));
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
