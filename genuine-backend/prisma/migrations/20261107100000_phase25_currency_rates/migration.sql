CREATE TABLE "BusinessExchangeRate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rateToBase" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessExchangeRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessExchangeRate_rateToBase_check" CHECK ("rateToBase" > 0),
    CONSTRAINT "BusinessExchangeRate_currencyCode_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
    CONSTRAINT "BusinessExchangeRate_currencies_check" CHECK ("currencyCode" <> "baseCurrency"),
    CONSTRAINT "BusinessExchangeRate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BusinessExchangeRate_businessId_baseCurrency_currencyCode_effectiveFrom_key"
ON "BusinessExchangeRate"("businessId", "baseCurrency", "currencyCode", "effectiveFrom");

CREATE INDEX "BusinessExchangeRate_businessId_currencyCode_effectiveFrom_idx"
ON "BusinessExchangeRate"("businessId", "currencyCode", "effectiveFrom");
