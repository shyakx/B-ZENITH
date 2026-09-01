-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('WAREHOUSE', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MENU_ITEM', 'RAW_MATERIAL', 'PACKAGED_GOOD');

-- CreateEnum
CREATE TYPE "UnitFamily" AS ENUM ('COUNT', 'WEIGHT', 'VOLUME');

-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_IN';

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "UnitFamily" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LocationKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPack" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "baseQuantity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reference" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packUnitId" TEXT,
    "packQuantity" INTEGER NOT NULL,
    "baseQuantity" INTEGER NOT NULL,
    "unitCost" INTEGER,

    CONSTRAINT "StockReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "baseQuantity" INTEGER NOT NULL,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'MENU_ITEM';
ALTER TABLE "Product" ADD COLUMN "sellOnPos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN "baseUnitId" TEXT;
ALTER TABLE "Product" ADD COLUMN "defaultStockLocationId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "stockLocationId" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "transferId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "receiptId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "receiptLineId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "orderId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "orderItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_code_key" ON "StockLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStock_productId_locationId_key" ON "ProductStock"("productId", "locationId");

-- CreateIndex
CREATE INDEX "ProductStock_locationId_quantity_idx" ON "ProductStock"("locationId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPack_productId_unitId_key" ON "ProductPack"("productId", "unitId");

-- CreateIndex
CREATE INDEX "Supplier_active_name_idx" ON "Supplier"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockReceipt_idempotencyKey_key" ON "StockReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockReceipt_supplierId_receivedAt_idx" ON "StockReceipt"("supplierId", "receivedAt");

-- CreateIndex
CREATE INDEX "StockReceipt_locationId_receivedAt_idx" ON "StockReceipt"("locationId", "receivedAt");

-- CreateIndex
CREATE INDEX "StockReceiptLine_receiptId_idx" ON "StockReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "StockReceiptLine_productId_idx" ON "StockReceiptLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_idempotencyKey_key" ON "StockTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockTransfer_fromLocationId_createdAt_idx" ON "StockTransfer"("fromLocationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_toLocationId_createdAt_idx" ON "StockTransfer"("toLocationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_productId_idx" ON "StockTransferLine"("productId");

-- CreateIndex
CREATE INDEX "Product_productType_active_idx" ON "Product"("productType", "active");

-- CreateIndex
CREATE INDEX "Product_sellOnPos_active_idx" ON "Product"("sellOnPos", "active");

-- CreateIndex
CREATE INDEX "Product_defaultStockLocationId_idx" ON "Product"("defaultStockLocationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_locationId_createdAt_idx" ON "InventoryMovement"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_transferId_idx" ON "InventoryMovement"("transferId");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultStockLocationId_fkey" FOREIGN KEY ("defaultStockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPack" ADD CONSTRAINT "ProductPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPack" ADD CONSTRAINT "ProductPack_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_packUnitId_fkey" FOREIGN KEY ("packUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "StockReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "ProductPack" ADD CONSTRAINT "ProductPack_baseQuantity_positive" CHECK ("baseQuantity" > 0);

-- Seed locations (stable ids, idempotent)
INSERT INTO "StockLocation" ("id", "code", "name", "kind", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('loc_MAIN', 'MAIN', 'Main Stock', 'WAREHOUSE', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('loc_BAR', 'BAR', 'Bar', 'OPERATIONAL', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('loc_KITCHEN', 'KITCHEN', 'Kitchen', 'OPERATIONAL', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('loc_CAFE', 'CAFE', 'Cafe', 'OPERATIONAL', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Seed units (names only, no conversion factors)
INSERT INTO "Unit" ("id", "code", "name", "family", "active", "createdAt", "updatedAt")
VALUES
  ('unit_PIECE', 'PIECE', 'Piece', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_BOTTLE', 'BOTTLE', 'Bottle', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_SHOT', 'SHOT', 'Shot', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_GLASS', 'GLASS', 'Glass', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_G', 'G', 'Gram', 'WEIGHT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_KG', 'KG', 'Kilogram', 'WEIGHT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_ML', 'ML', 'Millilitre', 'VOLUME', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_L', 'L', 'Litre', 'VOLUME', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_CRATE', 'CRATE', 'Crate', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_CARTON', 'CARTON', 'Carton', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_BAG', 'BAG', 'Bag', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('unit_BOX', 'BOX', 'Box', 'COUNT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Classify existing catalog: tracked drinks are packaged goods sold from Bar.
-- Inventory unit follows the SKU name: Shot / Glass / otherwise Bottle.
-- Does not rewrite stockQuantity and does not create ProductPack pour conversions.
UPDATE "Product"
SET
  "productType" = 'PACKAGED_GOOD',
  "sellOnPos" = true,
  "baseUnitId" = CASE
    WHEN "name" LIKE '%Shot' THEN (SELECT "id" FROM "Unit" WHERE "code" = 'SHOT')
    WHEN "name" LIKE '%Glass' THEN (SELECT "id" FROM "Unit" WHERE "code" = 'GLASS')
    ELSE (SELECT "id" FROM "Unit" WHERE "code" = 'BOTTLE')
  END,
  "defaultStockLocationId" = (SELECT "id" FROM "StockLocation" WHERE "code" = 'BAR')
WHERE "trackInventory" = true;

UPDATE "Product"
SET
  "productType" = 'MENU_ITEM',
  "sellOnPos" = true,
  "baseUnitId" = (SELECT "id" FROM "Unit" WHERE "code" = 'PIECE'),
  "defaultStockLocationId" = NULL
WHERE "trackInventory" = false;

-- Backfill ProductStock from live Product.stockQuantity into MAIN only.
INSERT INTO "ProductStock" ("id", "productId", "locationId", "quantity", "createdAt", "updatedAt")
SELECT
  CONCAT('ps_', loc."code", '_', p."id"),
  p."id",
  loc."id",
  CASE WHEN loc."code" = 'MAIN' THEN p."stockQuantity" ELSE 0 END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p
CROSS JOIN "StockLocation" loc
WHERE p."trackInventory" = true
ON CONFLICT ("productId", "locationId") DO NOTHING;
