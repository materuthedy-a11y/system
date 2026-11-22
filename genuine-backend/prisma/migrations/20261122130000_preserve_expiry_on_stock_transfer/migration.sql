ALTER TABLE "StockTransferItem"
ADD COLUMN "expiryDate" TIMESTAMP(3);

-- Recover expiry information for historical transfers where the matching
-- source batch still has a dated inbound movement.
UPDATE "StockTransferItem" AS item
SET "expiryDate" = (
  SELECT movement."expiryDate"
  FROM "StockTransfer" AS transfer
  JOIN "InventoryMovement" AS movement
    ON movement."businessId" = transfer."businessId"
   AND movement."productId" = item."productId"
   AND movement."locationId" = transfer."fromLocationId"
   AND movement."batchNumber" = item."batchNumber"
   AND movement."expiryDate" IS NOT NULL
   AND movement."quantity" > 0
   AND movement."type" <> 'TRANSFER'
  WHERE transfer."id" = item."transferId"
  ORDER BY movement."createdAt" DESC, movement."id" DESC
  LIMIT 1
)
WHERE item."batchNumber" IS NOT NULL;

-- Include the recovered batch expiry on both send and receive movements.
UPDATE "InventoryMovement" AS movement
SET "expiryDate" = item."expiryDate"
FROM "StockTransferItem" AS item
WHERE movement."referenceType" = 'StockTransfer'
  AND movement."referenceId" = item."transferId"
  AND movement."productId" = item."productId"
  AND movement."batchNumber" = item."batchNumber"
  AND movement."expiryDate" IS NULL
  AND item."expiryDate" IS NOT NULL;
