-- Report generation metadata and downloadable artifact registry.
-- Operational facts remain in the existing tenant-scoped domain tables.

CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "formats" JSONB NOT NULL,
    "factsJson" JSONB NOT NULL,
    "narrativeJson" JSONB,
    "model" TEXT,
    "usedOpenAi" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceLabel" TEXT,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportRun_tenantId_createdAt_idx" ON "ReportRun"("tenantId", "createdAt");
CREATE INDEX "ReportRun_tenantId_templateKey_idx" ON "ReportRun"("tenantId", "templateKey");
CREATE INDEX "ReportRun_tenantId_stationId_periodFrom_periodTo_idx" ON "ReportRun"("tenantId", "stationId", "periodFrom", "periodTo");

CREATE UNIQUE INDEX "ReportArtifact_reportRunId_format_key" ON "ReportArtifact"("reportRunId", "format");
CREATE INDEX "ReportArtifact_tenantId_createdAt_idx" ON "ReportArtifact"("tenantId", "createdAt");

CREATE INDEX "ReportSource_tenantId_reportRunId_idx" ON "ReportSource"("tenantId", "reportRunId");
CREATE INDEX "ReportSource_tenantId_sourceType_idx" ON "ReportSource"("tenantId", "sourceType");

ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSource" ADD CONSTRAINT "ReportSource_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
