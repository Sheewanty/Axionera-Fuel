CREATE TABLE "LubeBayMomoOperator" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stationId" TEXT,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LubeBayMomoOperator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LubeBayMomoOperator_tenantId_stationId_name_key" ON "LubeBayMomoOperator"("tenantId", "stationId", "name");
CREATE INDEX "LubeBayMomoOperator_tenantId_stationId_isActive_idx" ON "LubeBayMomoOperator"("tenantId", "stationId", "isActive");

ALTER TABLE "LubeBayMomoOperator"
  ADD CONSTRAINT "LubeBayMomoOperator_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
