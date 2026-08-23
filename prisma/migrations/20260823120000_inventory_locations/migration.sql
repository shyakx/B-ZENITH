-- AlterEnum
-- Values match prisma/schema.prisma enum InventoryMovementType
-- and existing DB type from 20260815160000_init.
ALTER TYPE "InventoryMovementType" ADD VALUE 'STOCK_TAKE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_IN';

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLocationStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLocationStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "sellingLocationId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "inventoryLocationId" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "counterpartLocationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");
CREATE UNIQUE INDEX "ProductLocationStock_productId_locationId_key" ON "ProductLocationStock"("productId", "locationId");
CREATE INDEX "ProductLocationStock_locationId_idx" ON "ProductLocationStock"("locationId");
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");
CREATE INDEX "InventoryMovement_locationId_createdAt_idx" ON "InventoryMovement"("locationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellingLocationId_fkey" FOREIGN KEY ("sellingLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductLocationStock" ADD CONSTRAINT "ProductLocationStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductLocationStock" ADD CONSTRAINT "ProductLocationStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_counterpartLocationId_fkey" FOREIGN KEY ("counterpartLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed locations. Application codes are MAIN_STOCK, BAR, KITCHEN.
INSERT INTO "InventoryLocation" ("id", "code", "name", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('cmainstock000000000000001', 'MAIN_STOCK', 'Main Stock', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cbarlocation0000000000001', 'BAR', 'Bar', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ckitchenloc00000000000001', 'KITCHEN', 'Kitchen', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Existing tracked on-hand becomes MAIN_STOCK only. Do not invent BAR/KITCHEN quantities.
INSERT INTO "ProductLocationStock" ("id", "productId", "locationId", "quantity", "createdAt", "updatedAt")
SELECT concat('cpls', substr(md5(p."id"), 1, 21)), p."id", 'cmainstock000000000000001', p."stockQuantity", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."trackInventory" = true;

UPDATE "Product"
SET "sellingLocationId" = 'cbarlocation0000000000001'
WHERE "trackInventory" = true AND "sellingLocationId" IS NULL;

-- Legacy movements belong to the previous single warehouse (MAIN_STOCK).
UPDATE "InventoryMovement"
SET "locationId" = 'cmainstock000000000000001'
WHERE "locationId" IS NULL;
