// ─── Pure business calculation functions ───────────────────────────────────
// All calculations must be executed server-side. Clients may preview but must
// never be trusted as the source of truth.

/**
 * Litres sold from meter readings.
 *
 * Returns the raw signed delta. A negative value means the current reading
 * is less than the previous — indicating a meter rollback, counter reset, or
 * data-entry error. Callers MUST validate the result before persisting:
 *   if (litres < 0) throw new Error("Meter rollback detected — verify readings")
 *
 * The old Math.max(0, ...) clamp was removed because silently hiding a negative
 * delta masks real operational errors and inflates expected cash to zero for that nozzle.
 */
export function calcLitresSold(currentMeter: number, previousMeter: number): number {
  return currentMeter - previousMeter;
}

/** Expected cash from pump nozzle */
export function calcExpectedAmount(litresSold: number, pricePerLitre: number): number {
  return litresSold * pricePerLitre;
}

/** 
 * Nozzle cash variance (multi-channel).
 * Positive = over-collection, Negative = shortage.
 */
export function calcNozzleVariance(
  cashReceived: number,
  gocardAmount: number,
  couponAmount: number,
  ghqrAmount: number,
  creditorsAmount: number,
  expectedAmount: number
): number {
  const totalCollected = cashReceived + gocardAmount + couponAmount + ghqrAmount + creditorsAmount;
  return totalCollected - expectedAmount;
}

/** HQ / Direct Settlement (sales that do not go to bank) */
export function calcHqSettlement(
  gocardAmount: number,
  couponAmount: number,
  ghqrAmount: number,
  creditorsAmount: number
): number {
  return gocardAmount + couponAmount + ghqrAmount + creditorsAmount;
}

/** Total litres sold from a set of pump readings for a given product/date */
export function calcTankMeterSold(readings: { litresSold: number }[]): number {
  return readings.reduce((sum, r) => sum + r.litresSold, 0);
}

/** Tank stock variance/loss */
export function calcTankVariance(
  openingStock: number,
  receipts: number,
  meterSold: number,
  closingStock: number
): number {
  return openingStock + receipts - meterSold - closingStock;
}

/** Product discharge: expected tank level after delivery */
export function calcExpectedTankAfterDischarge(
  beforeTankLitres: number,
  productDischargedLitres: number,
  topUpLitres: number
): number {
  return beforeTankLitres + productDischargedLitres + topUpLitres;
}

/** Product discharge: variance (positive = gain, negative = loss) */
export function calcDischargeVariance(
  afterTankLitres: number,
  expectedTankAfterDischarge: number
): number {
  return afterTankLitres - expectedTankAfterDischarge;
}

/** Net mart sales */
export function calcMartNetSales(
  posSales: number,
  cashSales: number,
  mobileMoney: number,
  returns: number
): number {
  return posSales + cashSales + mobileMoney - returns;
}

/** Mart physical cash variance */
export function calcMartVariance(cashCount: number, cashSales: number): number {
  return cashCount - cashSales;
}

/** Lube bay lubricant line amount */
export function calcLubeBayLubricantAmount(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/** Lube bay total expected sales */
export function calcLubeBayTotalExpected(
  lubricantAmount: number,
  labourCharge: number,
  partsCharge: number,
  discount: number
): number {
  return lubricantAmount + labourCharge + partsCharge - discount;
}

/** Lube bay settlement variance */
export function calcLubeBayVariance(
  cashAmount: number,
  cardAmount: number,
  momoAmount: number,
  creditorAmount: number,
  totalExpected: number
): number {
  return cashAmount + cardAmount + momoAmount + creditorAmount - totalExpected;
}

/** Net cash position for the station day (legacy, to be replaced by full reconciliation) */
export function calcNetCashPosition(
  cashBanked: number,
  martNetSales: number,
  expenditure: number
): number {
  return cashBanked + martNetSales - expenditure;
}

/** Net expenditure (gross minus cash returned to bank) */
export function calcNetExpenditure(
  grossExpenditure: number,
  paymentToBank: number
): number {
  return grossExpenditure - paymentToBank;
}

/** Physical cash available for banking (from pump sales) */
export function calcPhysicalCashToBank(
  totalCashReceived: number,
  netExpenditure: number
): number {
  return totalCashReceived - netExpenditure;
}

/** Cash collection variance (positive = overbanked, negative = underbanked) */
export function calcCashCollectionVariance(
  amountToBank: number,
  expectedCash: number
): number {
  return amountToBank - expectedCash;
}

/** Total accounted sales (pump) */
export function calcTotalAccountedSales(
  physicalCashToBank: number,
  hqSettlement: number,
  netExpenditure: number
): number {
  return physicalCashToBank + hqSettlement + netExpenditure;
}

/** Variance severity level for display */
export type VarianceSeverity = "ok" | "warning" | "danger";

export function varianceSeverity(
  variance: number,
  warningThreshold = 500,
  dangerThreshold = 2000
): VarianceSeverity {
  const abs = Math.abs(variance);
  if (abs === 0) return "ok";
  if (abs < warningThreshold) return "ok";
  if (abs < dangerThreshold) return "warning";
  return "danger";
}

/** Format a number as currency (GHS by default) */
export function formatCurrency(amount: number, currency = "GHS"): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format litres with 2 decimal places */
export function formatLitres(litres: number): string {
  return `${litres.toFixed(2)} L`;
}
