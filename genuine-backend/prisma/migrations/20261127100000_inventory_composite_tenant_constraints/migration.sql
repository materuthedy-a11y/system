DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "StockBalance" s
    JOIN "Product" p ON p."id" = s."productId"
    JOIN "Location" l ON l."id" = s."locationId"
    WHERE p."businessId" <> l."businessId"
  ) OR EXISTS (
    SELECT 1
    FROM "InventoryMovement" m
    JOIN "Product" p ON p."id" = m."productId"
    JOIN "Location" l ON l."id" = m."locationId"
    WHERE p."businessId" <> m."businessId" OR l."businessId" <> m."businessId"
  ) OR EXISTS (
    SELECT 1
    FROM "StockTransfer" t
    JOIN "Location" f ON f."id" = t."fromLocationId"
    JOIN "Location" d ON d."id" = t."toLocationId"
    WHERE f."businessId" <> t."businessId" OR d."businessId" <> t."businessId"
  ) OR EXISTS (
    SELECT 1
    FROM "StockTransferItem" i
    JOIN "StockTransfer" t ON t."id" = i."transferId"
    JOIN "Product" p ON p."id" = i."productId"
    WHERE p."businessId" <> t."businessId"
  ) OR EXISTS (
    SELECT 1
    FROM "StockAdjustmentItem" i
    JOIN "StockAdjustment" a ON a."id" = i."adjustmentId"
    JOIN "Product" p ON p."id" = i."productId"
    LEFT JOIN "Location" l ON l."id" = i."locationId"
    WHERE p."businessId" <> a."businessId"
       OR (l."id" IS NOT NULL AND l."businessId" <> a."businessId")
  ) OR EXISTS (
    SELECT 1
    FROM "PhysicalCount" c
    JOIN "Location" l ON l."id" = c."locationId"
    WHERE l."businessId" <> c."businessId"
  ) OR EXISTS (
    SELECT 1
    FROM "PhysicalCountItem" i
    JOIN "PhysicalCount" c ON c."id" = i."physicalCountId"
    JOIN "Product" p ON p."id" = i."productId"
    WHERE p."businessId" <> c."businessId"
  ) THEN
    RAISE EXCEPTION 'Inventory tenant constraint migration stopped: cross-business inventory references exist';
  END IF;
END $$;

ALTER TABLE "StockBalance" ADD COLUMN "businessId" TEXT;
UPDATE "StockBalance" s SET "businessId" = p."businessId"
FROM "Product" p WHERE p."id" = s."productId";
ALTER TABLE "StockBalance" ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "StockTransferItem" ADD COLUMN "businessId" TEXT;
UPDATE "StockTransferItem" i SET "businessId" = t."businessId"
FROM "StockTransfer" t WHERE t."id" = i."transferId";
ALTER TABLE "StockTransferItem" ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "StockAdjustmentItem" ADD COLUMN "businessId" TEXT;
UPDATE "StockAdjustmentItem" i SET "businessId" = a."businessId"
FROM "StockAdjustment" a WHERE a."id" = i."adjustmentId";
ALTER TABLE "StockAdjustmentItem" ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "PhysicalCountItem" ADD COLUMN "businessId" TEXT;
UPDATE "PhysicalCountItem" i SET "businessId" = c."businessId"
FROM "PhysicalCount" c WHERE c."id" = i."physicalCountId";
ALTER TABLE "PhysicalCountItem" ALTER COLUMN "businessId" SET NOT NULL;

CREATE UNIQUE INDEX "Location_businessId_id_key" ON "Location"("businessId", "id");
CREATE UNIQUE INDEX "StockTransfer_businessId_id_key" ON "StockTransfer"("businessId", "id");
CREATE UNIQUE INDEX "StockAdjustment_businessId_id_key" ON "StockAdjustment"("businessId", "id");
CREATE UNIQUE INDEX "PhysicalCount_businessId_id_key" ON "PhysicalCount"("businessId", "id");
CREATE INDEX "StockBalance_businessId_idx" ON "StockBalance"("businessId");
CREATE INDEX "StockTransferItem_businessId_idx" ON "StockTransferItem"("businessId");
CREATE INDEX "StockAdjustmentItem_businessId_idx" ON "StockAdjustmentItem"("businessId");
CREATE INDEX "PhysicalCountItem_businessId_idx" ON "PhysicalCountItem"("businessId");

ALTER TABLE "StockBalance" DROP CONSTRAINT "StockBalance_locationId_fkey";
ALTER TABLE "StockBalance" DROP CONSTRAINT "StockBalance_productId_fkey";
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_locationId_fkey";
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_productId_fkey";
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_fromLocationId_fkey";
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_toLocationId_fkey";
ALTER TABLE "StockTransferItem" DROP CONSTRAINT "StockTransferItem_productId_fkey";
ALTER TABLE "StockTransferItem" DROP CONSTRAINT "StockTransferItem_transferId_fkey";
ALTER TABLE "StockAdjustmentItem" DROP CONSTRAINT "StockAdjustmentItem_adjustmentId_fkey";
ALTER TABLE "StockAdjustmentItem" DROP CONSTRAINT "StockAdjustmentItem_locationId_fkey";
ALTER TABLE "StockAdjustmentItem" DROP CONSTRAINT "StockAdjustmentItem_productId_fkey";
ALTER TABLE "PhysicalCount" DROP CONSTRAINT "PhysicalCount_locationId_fkey";
ALTER TABLE "PhysicalCountItem" DROP CONSTRAINT "PhysicalCountItem_physicalCountId_fkey";
ALTER TABLE "PhysicalCountItem" DROP CONSTRAINT "PhysicalCountItem_productId_fkey";

ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_businessId_locationId_fkey"
  FOREIGN KEY ("businessId", "locationId") REFERENCES "Location"("businessId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StockBalance_businessId_productId_fkey"
  FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_businessId_locationId_fkey"
  FOREIGN KEY ("businessId", "locationId") REFERENCES "Location"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryMovement_businessId_productId_fkey"
  FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_businessId_fromLocationId_fkey"
  FOREIGN KEY ("businessId", "fromLocationId") REFERENCES "Location"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StockTransfer_businessId_toLocationId_fkey"
  FOREIGN KEY ("businessId", "toLocationId") REFERENCES "Location"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_businessId_productId_fkey"
  FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StockTransferItem_businessId_transferId_fkey"
  FOREIGN KEY ("businessId", "transferId") REFERENCES "StockTransfer"("businessId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockAdjustmentItem"
  ADD CONSTRAINT "StockAdjustmentItem_businessId_adjustmentId_fkey"
  FOREIGN KEY ("businessId", "adjustmentId") REFERENCES "StockAdjustment"("businessId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StockAdjustmentItem_businessId_productId_fkey"
  FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StockAdjustmentItem_businessId_locationId_fkey"
  FOREIGN KEY ("businessId", "locationId") REFERENCES "Location"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PhysicalCount"
  ADD CONSTRAINT "PhysicalCount_businessId_locationId_fkey"
  FOREIGN KEY ("businessId", "locationId") REFERENCES "Location"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PhysicalCountItem"
  ADD CONSTRAINT "PhysicalCountItem_businessId_physicalCountId_fkey"
  FOREIGN KEY ("businessId", "physicalCountId") REFERENCES "PhysicalCount"("businessId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PhysicalCountItem_businessId_productId_fkey"
  FOREIGN KEY ("businessId", "productId") REFERENCES "Product"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
