-- Enforce one mart sales summary per tenant/session.
CREATE UNIQUE INDEX "MartSale_tenantId_dailySessionId_key" ON "MartSale"("tenantId", "dailySessionId");
