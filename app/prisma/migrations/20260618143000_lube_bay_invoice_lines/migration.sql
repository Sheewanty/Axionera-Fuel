-- Lube bay sales now support service-type setup and multiple product lines.
ALTER TABLE "LubeBaySale"
  ADD COLUMN "serviceTypeId" TEXT,
  ADD COLUMN "vehicleCategory" TEXT,
  ADD COLUMN "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
  ADD COLUMN "momoOperator" TEXT,
  ADD COLUMN "momoNumber" TEXT,
  ADD COLUMN "cardDetails" TEXT;

CREATE TABLE "LubeBaySaleLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LubeBaySaleLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LubeBayServiceType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stationId" TEXT,
  "name" TEXT NOT NULL,
  "vehicleCategory" TEXT NOT NULL,
  "defaultLabourCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LubeBayServiceType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LubeBaySaleLine_tenantId_saleId_idx" ON "LubeBaySaleLine"("tenantId", "saleId");
CREATE INDEX "LubeBaySaleLine_tenantId_productId_idx" ON "LubeBaySaleLine"("tenantId", "productId");
CREATE UNIQUE INDEX "LubeBayServiceType_tenantId_stationId_name_vehicleCategory_key" ON "LubeBayServiceType"("tenantId", "stationId", "name", "vehicleCategory");
CREATE INDEX "LubeBayServiceType_tenantId_stationId_isActive_idx" ON "LubeBayServiceType"("tenantId", "stationId", "isActive");

ALTER TABLE "LubeBaySale"
  ADD CONSTRAINT "LubeBaySale_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "LubeBayServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LubeBaySaleLine"
  ADD CONSTRAINT "LubeBaySaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "LubeBaySale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LubeBaySaleLine"
  ADD CONSTRAINT "LubeBaySaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LubeBayServiceType"
  ADD CONSTRAINT "LubeBayServiceType_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
