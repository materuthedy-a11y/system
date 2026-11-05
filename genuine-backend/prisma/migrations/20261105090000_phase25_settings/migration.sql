ALTER TABLE "Business"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "phone2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Tanzania',
  ADD COLUMN "taxId" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "PaymentMethod"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "methodType" TEXT NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "requiresReference" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bankDetails" TEXT;

CREATE UNIQUE INDEX "PaymentMethod_businessId_code_key"
  ON "PaymentMethod"("businessId", "code");

CREATE TABLE "BusinessSettings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "defaultLocationId" TEXT,
  "defaultPaymentMethodId" TEXT,
  "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  "poPrefix" TEXT NOT NULL DEFAULT 'PO',
  "grnPrefix" TEXT NOT NULL DEFAULT 'GRN',
  "receiptPrefix" TEXT NOT NULL DEFAULT 'PAY',
  "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  "timeFormat" TEXT NOT NULL DEFAULT '24',
  "weekStartsOn" TEXT NOT NULL DEFAULT 'MONDAY',
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
  "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON "BusinessSettings"("businessId");
CREATE INDEX "BusinessSettings_businessId_idx" ON "BusinessSettings"("businessId");
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaxRate" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "rate" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "appliesTo" TEXT NOT NULL DEFAULT 'BOTH',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxRate_rate_range_check" CHECK ("rate" >= 0 AND "rate" <= 100),
  CONSTRAINT "TaxRate_appliesTo_check" CHECK ("appliesTo" IN ('SALES', 'PURCHASES', 'BOTH'))
);

CREATE UNIQUE INDEX "TaxRate_businessId_name_key" ON "TaxRate"("businessId", "name");
CREATE UNIQUE INDEX "TaxRate_businessId_code_key" ON "TaxRate"("businessId", "code");
CREATE INDEX "TaxRate_businessId_isActive_idx" ON "TaxRate"("businessId", "isActive");
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TaxRate" ("id", "businessId", "name", "code", "rate", "description", "appliesTo", "isDefault", "isActive", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", 'Standard tax', 'STANDARD', "taxPercentage", 'Migrated from the existing business tax percentage.', 'BOTH', true, true, CURRENT_TIMESTAMP
FROM "Business"
WHERE NOT EXISTS (SELECT 1 FROM "TaxRate" t WHERE t."businessId" = "Business"."id");
