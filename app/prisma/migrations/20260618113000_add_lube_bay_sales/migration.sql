-- Create lube bay sales register.
CREATE TABLE "LubeBaySale" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "dailySessionId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "vehicleReg" TEXT NOT NULL,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "serviceType" TEXT NOT NULL,
  "lubricantProductId" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lubricantAmount" DECIMAL(12,2) NOT NULL,
  "labourCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "partsCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalExpected" DECIMAL(12,2) NOT NULL,
  "cashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cardAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "momoAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "creditorAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "creditorId" TEXT,
  "variance" DECIMAL(12,2) NOT NULL,
  "technicianName" TEXT,
  "supervisorName" TEXT,
  "remarks" TEXT,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LubeBaySale_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LubeBaySale"
  ADD CONSTRAINT "LubeBaySale_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LubeBaySale"
  ADD CONSTRAINT "LubeBaySale_dailySessionId_fkey" FOREIGN KEY ("dailySessionId") REFERENCES "DailySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LubeBaySale"
  ADD CONSTRAINT "LubeBaySale_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LubeBaySale"
  ADD CONSTRAINT "LubeBaySale_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LubeBaySale_tenantId_stationId_businessDate_idx" ON "LubeBaySale"("tenantId", "stationId", "businessDate");
CREATE INDEX "LubeBaySale_tenantId_dailySessionId_idx" ON "LubeBaySale"("tenantId", "dailySessionId");
CREATE INDEX "LubeBaySale_tenantId_vehicleReg_idx" ON "LubeBaySale"("tenantId", "vehicleReg");

-- Link creditor ledger rows created from lube bay credit sales.
ALTER TABLE "CreditorLedgerEntry" ADD COLUMN "lubeBaySaleId" TEXT;

ALTER TABLE "CreditorLedgerEntry"
  ADD CONSTRAINT "CreditorLedgerEntry_lubeBaySaleId_fkey" FOREIGN KEY ("lubeBaySaleId") REFERENCES "LubeBaySale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
