import { Db } from "./types";
import { ClosePumpReadingInput, OpenPumpReadingInput } from "../schemas/pump-reading.schema";
import { calcLitresSold, calcExpectedAmount, calcNozzleVariance } from "../calculations";

async function validateSessionAndNozzle(
  tenantId: string,
  input: OpenPumpReadingInput | ClosePumpReadingInput,
  db: Db
) {
  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });
  if (!session || session.tenantId !== tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (session.status === "APPROVED") {
    throw new Error("Cannot modify an approved session");
  }
  if (session.status !== "OPEN" && session.status !== "REOPENED") {
    throw new Error(`Cannot modify pump readings while session is ${session.status}`);
  }

  const nozzle = await db.nozzle.findUnique({
    where: { id: input.nozzleId },
  });
  if (!nozzle || nozzle.tenantId !== tenantId || nozzle.stationId !== input.stationId) {
    throw new Error("Invalid or mismatched nozzle");
  }
  if (nozzle.pumpId !== input.pumpId || nozzle.productId !== input.productId) {
    throw new Error("Nozzle pump or product mismatch");
  }

  const latestPrice = await db.priceHistory.findFirst({
    where: { productId: input.productId, stationId: input.stationId, tenantId },
    orderBy: { effectiveFrom: "desc" },
  });
  const pricePerLitre = latestPrice ? Number(latestPrice.pricePerLitre) : 0;

  if (pricePerLitre <= 0) {
    throw new Error("Active price not found or invalid for this product");
  }

  return { pricePerLitre };
}

export async function recordOpeningPumpReading(
  tenantId: string,
  userId: string,
  input: OpenPumpReadingInput,
  db: Db
) {
  const { pricePerLitre } = await validateSessionAndNozzle(tenantId, input, db);

  const existingReading = await db.pumpReading.findFirst({
    where: { dailySessionId: input.dailySessionId, nozzleId: input.nozzleId, tenantId },
  });
  if (existingReading) {
    throw new Error("Opening meter already exists for this nozzle in this session");
  }

  const latestReading = await db.pumpReading.findFirst({
    where: {
      nozzleId: input.nozzleId,
      tenantId,
      isClosingRecorded: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const previousClosingLitre = latestReading ? Number(latestReading.currentLitre) : 0;

  if (input.openingLitre < previousClosingLitre) {
    throw new Error(`Opening meter reading (${input.openingLitre}) cannot be less than previous closing reading (${previousClosingLitre})`);
  }

  return db.pumpReading.create({
    data: {
      tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: new Date(input.businessDate),
      shift: input.shift,
      pumpId: input.pumpId,
      nozzleId: input.nozzleId,
      productId: input.productId,
      attendantId: input.attendantId || null,
      previousLitre: input.openingLitre,
      currentLitre: input.openingLitre,
      litresSold: 0,
      pricePerLitre,
      amountExpected: 0,
      cashReceived: 0,
      gocardAmount: 0,
      couponAmount: 0,
      ghqrAmount: 0,
      creditorsAmount: 0,
      variance: 0,
      isClosingRecorded: false,
      remarks: input.remarks,
      createdBy: userId,
    },
  });
}

export async function recordClosingPumpReading(
  tenantId: string,
  userId: string,
  input: ClosePumpReadingInput,
  db: Db
) {
  const { pricePerLitre } = await validateSessionAndNozzle(tenantId, input, db);

  const existingReading = await db.pumpReading.findFirst({
    where: { dailySessionId: input.dailySessionId, nozzleId: input.nozzleId, tenantId },
  });
  if (!existingReading) {
    throw new Error("Opening meter must be recorded before closing meter for this nozzle");
  }
  if (existingReading.isClosingRecorded) {
    throw new Error("Closing meter already exists for this nozzle in this session");
  }

  const openingLitre = Number(existingReading.previousLitre);
  if (input.currentLitre < openingLitre) {
    throw new Error(`Closing meter reading (${input.currentLitre}) cannot be less than opening reading (${openingLitre})`);
  }

  const litresSold = calcLitresSold(input.currentLitre, openingLitre);
  const amountExpected = calcExpectedAmount(litresSold, pricePerLitre);
  const variance = calcNozzleVariance(
    input.cashReceived,
    input.gocardAmount,
    input.couponAmount,
    input.ghqrAmount,
    input.creditorsAmount,
    amountExpected
  );

  return db.pumpReading.update({
    where: { id: existingReading.id },
    data: {
      currentLitre: input.currentLitre,
      litresSold,
      pricePerLitre,
      amountExpected,
      cashReceived: input.cashReceived,
      gocardAmount: input.gocardAmount,
      couponAmount: input.couponAmount,
      ghqrAmount: input.ghqrAmount,
      creditorsAmount: input.creditorsAmount,
      variance,
      isClosingRecorded: true,
      remarks: input.remarks,
      updatedBy: userId,
    },
  });
}
