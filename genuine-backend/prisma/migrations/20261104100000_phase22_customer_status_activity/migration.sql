ALTER TABLE "Customer" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
UPDATE "Customer" SET "status" = 'SUSPENDED' WHERE "isActive" = FALSE;

CREATE TABLE "CustomerActivity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerActivity_businessId_customerId_createdAt_idx"
ON "CustomerActivity"("businessId", "customerId", "createdAt");
CREATE INDEX "CustomerActivity_userId_idx" ON "CustomerActivity"("userId");

ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
