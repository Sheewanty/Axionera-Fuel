-- Add product discharge water-test capture.
ALTER TABLE "ProductDischarge"
  ADD COLUMN "tankerWaterTestStatus" TEXT NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "receivingTankWaterTestStatus" TEXT NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "waterTestRemarks" TEXT;

-- Daily detail records for HQ/direct channels and creditors.
CREATE TABLE "PaymentDetail" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "dailySessionId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "productId" TEXT,
  "pumpReadingId" TEXT,
  "channel" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "customerName" TEXT,
  "attendantName" TEXT,
  "referenceNumber" TEXT,
  "serialNumber" TEXT,
  "phoneNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "remarks" TEXT,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentDetail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentDetail_tenantId_dailySessionId_idx"
  ON "PaymentDetail"("tenantId", "dailySessionId");

CREATE INDEX "PaymentDetail_tenantId_stationId_businessDate_idx"
  ON "PaymentDetail"("tenantId", "stationId", "businessDate");

CREATE INDEX "PaymentDetail_tenantId_channel_status_idx"
  ON "PaymentDetail"("tenantId", "channel", "status");

ALTER TABLE "PaymentDetail"
  ADD CONSTRAINT "PaymentDetail_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentDetail"
  ADD CONSTRAINT "PaymentDetail_dailySessionId_fkey"
  FOREIGN KEY ("dailySessionId") REFERENCES "DailySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentDetail"
  ADD CONSTRAINT "PaymentDetail_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
