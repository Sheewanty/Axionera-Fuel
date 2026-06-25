import type { Db } from "./types";

export const STOCK_ADJUSTMENT_DIRECTIONS = ["IN", "OUT"] as const;
export const STOCK_ADJUSTMENT_TYPES = [
  "REGULATORY_INSPECTION",
  "STOCK_CORRECTION",
  "EVAPORATION",
  "OTHER",
] as const;

export type StockAdjustmentDirection = (typeof STOCK_ADJUSTMENT_DIRECTIONS)[number];
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

export type CreateStockAdjustmentInput = {
  tenantId: string;
  stationId: string;
  dailySessionId: string;
  businessDate: Date;
  tankId: string;
  productId: string;
  adjustmentType: StockAdjustmentType;
  direction: StockAdjustmentDirection;
  litres: number;
  authorityReason?: string | null;
  reference?: string | null;
  recordedByName?: string | null;
  approvedByName?: string | null;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  remarks?: string | null;
  createdBy: string;
};

export async function getApprovedStockAdjustmentTotals(
  db: Db,
  tenantId: string,
  dailySessionId: string,
  tankId: string
): Promise<{ adjustmentInLitres: number; adjustmentOutLitres: number }> {
  const adjustments = await db.stockAdjustment.findMany({
    where: {
      tenantId,
      dailySessionId,
      tankId,
      approvalStatus: "APPROVED",
    },
    select: { direction: true, litres: true },
  });

  return adjustments.reduce(
    (totals, adjustment) => {
      const litres = Number(adjustment.litres);
      if (adjustment.direction === "IN") totals.adjustmentInLitres += litres;
      if (adjustment.direction === "OUT") totals.adjustmentOutLitres += litres;
      return totals;
    },
    { adjustmentInLitres: 0, adjustmentOutLitres: 0 }
  );
}

export async function createStockAdjustment(db: Db, input: CreateStockAdjustmentInput) {
  if (input.litres <= 0) {
    throw new Error("Stock adjustment litres must be greater than zero");
  }

  const session = await db.dailySession.findUnique({ where: { id: input.dailySessionId } });
  if (!session || session.tenantId !== input.tenantId || session.stationId !== input.stationId) {
    throw new Error("Invalid session or tenant mismatch");
  }
  if (session.status === "READY_FOR_REVIEW" || session.status === "APPROVED") {
    throw new Error(`Cannot modify stock adjustments for a session that is ${session.status}`);
  }

  const tank = await db.tank.findUnique({ where: { id: input.tankId } });
  if (
    !tank ||
    tank.tenantId !== input.tenantId ||
    tank.stationId !== input.stationId ||
    tank.productId !== input.productId
  ) {
    throw new Error("Invalid or mismatched tank");
  }

  return db.stockAdjustment.create({
    data: {
      tenantId: input.tenantId,
      stationId: input.stationId,
      dailySessionId: input.dailySessionId,
      businessDate: input.businessDate,
      tankId: input.tankId,
      productId: input.productId,
      adjustmentType: input.adjustmentType,
      direction: input.direction,
      litres: input.litres,
      authorityReason: input.authorityReason,
      reference: input.reference,
      recordedByName: input.recordedByName,
      approvedByName: input.approvedByName,
      approvalStatus: input.approvalStatus ?? "APPROVED",
      remarks: input.remarks,
      createdBy: input.createdBy,
    },
  });
}
