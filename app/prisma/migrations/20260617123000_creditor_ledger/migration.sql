-- Controlled creditor register and ledger.
-- Credit sales increase indebtedness; creditor payments reduce indebtedness.

CREATE TABLE "Creditor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "creditLimit" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creditor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditorLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "dailySessionId" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "productId" TEXT,
    "pumpReadingId" TEXT,
    "paymentMethod" TEXT,
    "chequeNumber" TEXT,
    "chequeName" TEXT,
    "chequeBank" TEXT,
    "chequeBranch" TEXT,
    "chequeClearingDate" DATE,
    "cashReceivedDate" DATE,
    "cardDetails" TEXT,
    "momoOperator" TEXT,
    "momoNumber" TEXT,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditorLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Creditor_tenantId_stationId_name_key" ON "Creditor"("tenantId", "stationId", "name");
CREATE INDEX "Creditor_tenantId_stationId_status_idx" ON "Creditor"("tenantId", "stationId", "status");
CREATE INDEX "CreditorLedgerEntry_tenantId_stationId_dailySessionId_idx" ON "CreditorLedgerEntry"("tenantId", "stationId", "dailySessionId");
CREATE INDEX "CreditorLedgerEntry_tenantId_creditorId_businessDate_idx" ON "CreditorLedgerEntry"("tenantId", "creditorId", "businessDate");
CREATE INDEX "CreditorLedgerEntry_tenantId_type_paymentMethod_idx" ON "CreditorLedgerEntry"("tenantId", "type", "paymentMethod");

ALTER TABLE "Creditor" ADD CONSTRAINT "Creditor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Creditor" ADD CONSTRAINT "Creditor_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditorLedgerEntry" ADD CONSTRAINT "CreditorLedgerEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditorLedgerEntry" ADD CONSTRAINT "CreditorLedgerEntry_dailySessionId_fkey" FOREIGN KEY ("dailySessionId") REFERENCES "DailySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditorLedgerEntry" ADD CONSTRAINT "CreditorLedgerEntry_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Creditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditorLedgerEntry" ADD CONSTRAINT "CreditorLedgerEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
