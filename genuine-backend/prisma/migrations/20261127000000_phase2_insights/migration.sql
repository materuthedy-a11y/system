-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "evidence" JSONB,
    "impact" JSONB,
    "recommendation" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "productId" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "locationId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "dismissedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insight_businessId_dedupeKey_key" ON "Insight"("businessId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Insight_businessId_status_severity_idx" ON "Insight"("businessId", "status", "severity");

-- CreateIndex
CREATE INDEX "Insight_businessId_type_idx" ON "Insight"("businessId", "type");

-- CreateIndex
CREATE INDEX "Insight_businessId_locationId_idx" ON "Insight"("businessId", "locationId");

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
