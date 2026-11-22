ALTER TABLE "StockAdjustmentItem"
ADD COLUMN "expiryDate" TIMESTAMP(3);

ALTER TABLE "PhysicalCountItem"
ADD COLUMN "expiryDate" TIMESTAMP(3);

UPDATE "StockAdjustmentItem" AS item
SET "expiryDate" = movement."expiryDate"
FROM "InventoryMovement" AS movement
WHERE movement."referenceType" = 'StockAdjustment'
  AND movement."referenceId" = item."adjustmentId"
  AND movement."productId" = item."productId"
  AND movement."batchNumber" = item."batchNumber"
  AND movement."expiryDate" IS NOT NULL;

UPDATE "PhysicalCountItem" AS item
SET "expiryDate" = movement."expiryDate"
FROM "InventoryMovement" AS movement
WHERE movement."referenceType" = 'PhysicalCount'
  AND movement."referenceId" = item."physicalCountId"
  AND movement."productId" = item."productId"
  AND movement."batchNumber" = item."batchNumber"
  AND movement."expiryDate" IS NOT NULL;
