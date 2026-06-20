import { Db } from "./types";
import { CorrectTankDippingInput, CreateTankDippingInput } from "../schemas/tank-dipping.schema";
import { calcTankVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

export async function createTankDipping(
  tenantId: string,
  userId: string,
  input: CreateTankDippingInput,
  db: Db
) {
  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });
  if (!session || session.tenantId !== tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify tank dipping for a session that is ${session.status}`);
  }

  const tank = await db.tank.findUnique({
    where: { id: input.tankId },
  });
  if (!tank || tank.tenantId !== tenantId || tank.stationId !== input.stationId) {
    throw new Error("Invalid or mismatched tank");
  }
  if (tank.productId !== input.productId) {
    throw new Error("Tank product mismatch");
  }

  // Prevent duplicates
  const existingDipping = await db.tankDipping.findFirst({
    where: { dailySessionId: input.dailySessionId, tankId: input.tankId, tenantId },
  });
  if (existingDipping) {
    throw new Error("Tank dipping already exists for this tank in this session");
  }

  // Server-derived after initialization; first tank dipping seeds the opening baseline.
  const latestDipping = await db.tankDipping.findFirst({
    where: { tankId: input.tankId, tenantId },
    orderBy: { createdAt: "desc" },
  });
  const openingStockLitres = latestDipping ? Number(latestDipping.closingStockLitres) : input.openingStockLitres;

  // Server-derived meter sold
  const pumpReadings = await db.pumpReading.findMany({
    where: { dailySessionId: input.dailySessionId, productId: input.productId, tenantId },
    select: { litresSold: true },
  });
  const meterSoldLitres = pumpReadings.reduce((sum, r) => sum + Number(r.litresSold), 0);

  const varianceLitres = calcTankVariance(
    openingStockLitres,
    input.receiptsLitres,
    meterSoldLitres,
    input.closingStockLitres
  );

  const dipping = await db.tankDipping.create({
    data: {
      tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: new Date(input.businessDate),
      tankId: input.tankId,
      productId: input.productId,
      
      openingStockLitres: openingStockLitres,
      receiptsLitres: input.receiptsLitres,
      meterSoldLitres: meterSoldLitres,
      closingStockLitres: input.closingStockLitres,
      closingDipCm: input.closingDipCm,
      varianceLitres,
      
      waterTestStatus: input.waterTestStatus,
      remarks: input.remarks,
      createdBy: userId,
    },
  });

  return dipping;
}

export async function correctTankDipping(
  tenantId: string,
  userId: string,
  input: CorrectTankDippingInput,
  db: Db
) {
  const existing = await db.tankDipping.findUnique({
    where: { id: input.id },
  });
  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.stationId !== input.stationId ||
    existing.dailySessionId !== input.dailySessionId ||
    existing.tankId !== input.tankId
  ) {
    throw new Error("Tank dipping not found or mismatch");
  }

  const session = await db.dailySession.findUnique({
    where: { id: input.dailySessionId },
  });
  if (!session || session.tenantId !== tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (LOCKED_SESSION_STATUSES.has(session.status)) {
    throw new Error(`Cannot modify tank dipping for a session that is ${session.status}`);
  }

  const tank = await db.tank.findUnique({
    where: { id: input.tankId },
  });
  if (!tank || tank.tenantId !== tenantId || tank.stationId !== input.stationId || tank.productId !== input.productId) {
    throw new Error("Invalid or mismatched tank");
  }

  const openingStockLitres = Number(existing.openingStockLitres);

  const pumpReadings = await db.pumpReading.findMany({
    where: { dailySessionId: input.dailySessionId, productId: input.productId, tenantId },
    select: { litresSold: true },
  });
  const meterSoldLitres = pumpReadings.reduce((sum, r) => sum + Number(r.litresSold), 0);

  const varianceLitres = calcTankVariance(
    openingStockLitres,
    input.receiptsLitres,
    meterSoldLitres,
    input.closingStockLitres
  );

  return db.tankDipping.update({
    where: { id: input.id },
    data: {
      openingStockLitres,
      receiptsLitres: input.receiptsLitres,
      meterSoldLitres,
      closingStockLitres: input.closingStockLitres,
      closingDipCm: input.closingDipCm,
      varianceLitres,
      waterTestStatus: input.waterTestStatus,
      remarks: appendCorrectionNote(input.remarks ?? existing.remarks, input.correctionReason),
      updatedBy: userId,
    },
  });
}
