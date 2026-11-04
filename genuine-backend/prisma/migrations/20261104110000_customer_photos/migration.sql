CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");

CREATE TABLE "CustomerPhoto" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/webp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPhoto_customerId_key" ON "CustomerPhoto"("customerId");
CREATE UNIQUE INDEX "CustomerPhoto_businessId_customerId_key" ON "CustomerPhoto"("businessId", "customerId");
CREATE INDEX "CustomerPhoto_businessId_customerId_idx" ON "CustomerPhoto"("businessId", "customerId");

ALTER TABLE "CustomerPhoto" ADD CONSTRAINT "CustomerPhoto_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPhoto" ADD CONSTRAINT "CustomerPhoto_businessId_customerId_fkey"
FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
