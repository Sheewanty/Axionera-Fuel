import { CashCollection, Prisma } from "@prisma/client";
import { Db } from "./types";
import { CashCollectionInput } from "../schemas/cash-collection.schema";
import { calcPhysicalCashToBank, calcCashCollectionVariance } from "../calculations";

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
  if (session.status === "APPROVED") {
    throw new Error("Cannot modify an approved session");
  }

  // Calculate total cash received from pump readings for this session
  const pumpReadings = await db.pumpReading.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { cashReceived: true },
  });
  const totalCashReceived = pumpReadings.reduce((sum, r) => sum + Number(r.cashReceived), 0);

  // Calculate net expenditure for this session
  const expenditures = await db.expenditure.findMany({
    where: {
      tenantId,
      dailySessionId: input.dailySessionId,
    },
    select: { amount: true, paymentToBank: true },
  });
  const totalNetExpenditure = expenditures.reduce((sum, exp) => {
    return sum + (Number(exp.amount) - Number(exp.paymentToBank));
  }, 0);

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
