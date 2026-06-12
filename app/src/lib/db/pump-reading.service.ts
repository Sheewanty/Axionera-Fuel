import { Db } from "./types";
import { CreatePumpReadingInput } from "../schemas/pump-reading.schema";
import { calcLitresSold, calcExpectedAmount, calcNozzleVariance } from "../calculations";

export async function createPumpReading(
  tenantId: string,
  userId: string,
  input: CreatePumpReadingInput,
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

  const nozzle = await db.nozzle.findUnique({
    where: { id: input.nozzleId },
  });
  if (!nozzle || nozzle.tenantId !== tenantId || nozzle.stationId !== input.stationId) {
    throw new Error("Invalid or mismatched nozzle");
  }
  if (nozzle.pumpId !== input.pumpId || nozzle.productId !== input.productId) {
    throw new Error("Nozzle pump or product mismatch");
  }

  // Prevent duplicates
  const existingReading = await db.pumpReading.findFirst({
    where: { dailySessionId: input.dailySessionId, nozzleId: input.nozzleId, tenantId },
  });
  if (existingReading) {
    throw new Error("Pump reading already exists for this nozzle in this session");
  }

  // Server-derived previous meter
  const latestReading = await db.pumpReading.findFirst({
    where: { nozzleId: input.nozzleId, tenantId },
    orderBy: { createdAt: "desc" },
  });
  const previousLitre = latestReading ? Number(latestReading.currentLitre) : 0;

  // Server-derived price
  const latestPrice = await db.priceHistory.findFirst({
    where: { productId: input.productId, stationId: input.stationId, tenantId },
    orderBy: { effectiveFrom: "desc" },
  });
  const pricePerLitre = latestPrice ? Number(latestPrice.pricePerLitre) : 0;

  if (pricePerLitre <= 0) {
    throw new Error("Active price not found or invalid for this product");
  }

  if (input.currentLitre < previousLitre) {
    throw new Error(`Current meter reading (${input.currentLitre}) cannot be less than previous reading (${previousLitre})`);
  }

  // Derive calculations server-side using server values
  const litresSold = calcLitresSold(input.currentLitre, previousLitre);
  const amountExpected = calcExpectedAmount(litresSold, pricePerLitre);

  const variance = calcNozzleVariance(
    input.cashReceived,
    input.gocardAmount,
    input.couponAmount,
    input.ghqrAmount,
    input.creditorsAmount,
    amountExpected
  );

  const reading = await db.pumpReading.create({
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
      
      previousLitre: previousLitre,
      currentLitre: input.currentLitre,
      litresSold,
      pricePerLitre: pricePerLitre,
      amountExpected,
      
      cashReceived: input.cashReceived,
      gocardAmount: input.gocardAmount,
      couponAmount: input.couponAmount,
      ghqrAmount: input.ghqrAmount,
      creditorsAmount: input.creditorsAmount,
      variance,
      
      remarks: input.remarks,
      createdBy: userId,
    },
  });

  return reading;
}
