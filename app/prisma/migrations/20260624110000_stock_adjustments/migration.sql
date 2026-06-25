-- Stock adjustments capture approved non-sales product movements such as NPA
-- inspection draw-offs. Approved rows affect tank variance; they never affect
-- pump revenue, HQ settlement, debtor sales, or bankable cash.

CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "dailySessionId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "tankId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "litres" DECIMAL(12,2) NOT NULL,
    "authorityReason" TEXT,
    "reference" TEXT,
    "recordedByName" TEXT,
    "approvedByName" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "remarks" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockAdjustment_tenantId_dailySessionId_idx" ON "StockAdjustment"("tenantId", "dailySessionId");
CREATE INDEX "StockAdjustment_tenantId_dailySessionId_tankId_idx" ON "StockAdjustment"("tenantId", "dailySessionId", "tankId");
CREATE INDEX "StockAdjustment_tenantId_stationId_businessDate_idx" ON "StockAdjustment"("tenantId", "stationId", "businessDate");

ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_dailySessionId_fkey" FOREIGN KEY ("dailySessionId") REFERENCES "DailySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
