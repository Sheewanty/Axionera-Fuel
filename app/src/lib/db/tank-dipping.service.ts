import { Db } from "./types";
import { CorrectTankDippingInput, CreateTankDippingInput } from "../schemas/tank-dipping.schema";
import { calcTankVariance } from "../calculations";
import { appendCorrectionNote } from "../corrections";
import { getApprovedStockAdjustmentTotals } from "./stock-adjustment.service";

const LOCKED_SESSION_STATUSES = new Set(["READY_FOR_REVIEW", "APPROVED"]);

async function getSessionProductMeterSold(
  tenantId: string,
  dailySessionId: string,
  productId: string,
  db: Db
): Promise<number> {
  const pumpReadings = await db.pumpReading.findMany({
    where: { dailySessionId, productId, tenantId, isClosingRecorded: true },
    select: { litresSold: true },
  });
  return pumpReadings.reduce((sum, r) => sum + Number(r.litresSold), 0);
}

export async function recalculateTankDippingsForSessionProduct(
  tenantId: string,
  dailySessionId: string,
  productId: string,
  db: Db
) {
  const meterSoldLitres = await getSessionProductMeterSold(tenantId, dailySessionId, productId, db);
  const dippings = await db.tankDipping.findMany({
    where: { tenantId, dailySessionId, productId },
    select: {
      id: true,
      tankId: true,
      openingStockLitres: true,
      receiptsLitres: true,
      closingStockLitres: true,
    },
  });

  await Promise.all(
    dippings.map(async (dipping) => {
      const adjustments = await getApprovedStockAdjustmentTotals(db, tenantId, dailySessionId, dipping.tankId);
      return db.tankDipping.update({
        where: { id: dipping.id },
        data: {
          meterSoldLitres,
          varianceLitres: calcTankVariance(
            Number(dipping.openingStockLitres),
            Number(dipping.receiptsLitres),
            meterSoldLitres,
            Number(dipping.closingStockLitres),
            adjustments.adjustmentInLitres,
            adjustments.adjustmentOutLitres
          ),
        },
      });
    })
  );
}

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
  const meterSoldLitres = await getSessionProductMeterSold(tenantId, input.dailySessionId, input.productId, db);
  const adjustments = await getApprovedStockAdjustmentTotals(db, tenantId, input.dailySessionId, input.tankId);

  const varianceLitres = calcTankVariance(
    openingStockLitres,
    input.receiptsLitres,
    meterSoldLitres,
    input.closingStockLitres,
    adjustments.adjustmentInLitres,
    adjustments.adjustmentOutLitres
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

  const meterSoldLitres = await getSessionProductMeterSold(tenantId, input.dailySessionId, input.productId, db);
  const adjustments = await getApprovedStockAdjustmentTotals(db, tenantId, input.dailySessionId, input.tankId);

  const varianceLitres = calcTankVariance(
    openingStockLitres,
    input.receiptsLitres,
    meterSoldLitres,
    input.closingStockLitres,
    adjustments.adjustmentInLitres,
    adjustments.adjustmentOutLitres
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
