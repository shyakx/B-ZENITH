-- CreateEnum
CREATE TYPE "ServiceChannel" AS ENUM ('TABLE', 'WALK_IN', 'COUNTER', 'ACCOMMODATION', 'DELIVERY', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'SETTLING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('ACTIVE', 'VOIDED', 'RETURNED', 'EXCHANGED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('VOID', 'RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('RESELLABLE', 'DAMAGED', 'OPENED', 'CONSUMED', 'OTHER');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('POSTED', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('OUTSTANDING', 'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "StaffActionType" AS ENUM ('OPENED', 'HANDOVER', 'ROUND_POSTED', 'VOID_REQUESTED', 'VOID_APPROVED', 'RETURN_PROCESSED', 'EXCHANGE_PROCESSED', 'SETTLEMENT_REQUESTED', 'SETTLED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'SESSION_POST';
ALTER TYPE "InventoryMovementType" ADD VALUE 'ORDER_VOID';

-- DropIndex
DROP INDEX "Payment_saleId_key";

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receivedById" TEXT;

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSession" (
    "id" TEXT NOT NULL,
    "channel" "ServiceChannel" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "waiterId" TEXT NOT NULL,
    "tableId" TEXT,
    "destinationLabel" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "deliveryAddress" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedSettlementAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionStaffHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "action" "StaffActionType" NOT NULL,
    "previousStaffId" TEXT,
    "note" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionStaffHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "OrderRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionItem" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "inventoryLocationId" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'POSTED',
    "fulfillmentStaffId" TEXT,
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionItemFulfillmentHistory" (
    "id" TEXT NOT NULL,
    "sessionItemId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL,
    "staffId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionItemFulfillmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAdjustment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "originalItemId" TEXT NOT NULL,
    "replacementItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "condition" "ItemCondition",
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditBill" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "sessionId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL,
    "creditBillId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "receivedById" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Table_name_key" ON "Table"("name");

-- CreateIndex
CREATE INDEX "ServiceSession_status_idx" ON "ServiceSession"("status");

-- CreateIndex
CREATE INDEX "ServiceSession_waiterId_idx" ON "ServiceSession"("waiterId");

-- CreateIndex
CREATE INDEX "ServiceSession_tableId_idx" ON "ServiceSession"("tableId");

-- CreateIndex
CREATE INDEX "SessionStaffHistory_sessionId_idx" ON "SessionStaffHistory"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRound_idempotencyKey_key" ON "OrderRound"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderRound_sessionId_idx" ON "OrderRound"("sessionId");

-- CreateIndex
CREATE INDEX "SessionItem_roundId_idx" ON "SessionItem"("roundId");

-- CreateIndex
CREATE INDEX "SessionItem_productId_idx" ON "SessionItem"("productId");

-- CreateIndex
CREATE INDEX "SessionItemFulfillmentHistory_sessionItemId_idx" ON "SessionItemFulfillmentHistory"("sessionItemId");

-- CreateIndex
CREATE INDEX "OrderAdjustment_sessionId_idx" ON "OrderAdjustment"("sessionId");

-- CreateIndex
CREATE INDEX "OrderAdjustment_originalItemId_idx" ON "OrderAdjustment"("originalItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBill_saleId_key" ON "CreditBill"("saleId");

-- CreateIndex
CREATE INDEX "CreditBill_status_idx" ON "CreditBill"("status");

-- CreateIndex
CREATE INDEX "CreditPayment_creditBillId_idx" ON "CreditPayment"("creditBillId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_sessionId_key" ON "Sale"("sessionId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionStaffHistory" ADD CONSTRAINT "SessionStaffHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionStaffHistory" ADD CONSTRAINT "SessionStaffHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_fulfillmentStaffId_fkey" FOREIGN KEY ("fulfillmentStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItemFulfillmentHistory" ADD CONSTRAINT "SessionItemFulfillmentHistory_sessionItemId_fkey" FOREIGN KEY ("sessionItemId") REFERENCES "SessionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItemFulfillmentHistory" ADD CONSTRAINT "SessionItemFulfillmentHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_originalItemId_fkey" FOREIGN KEY ("originalItemId") REFERENCES "SessionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_replacementItemId_fkey" FOREIGN KEY ("replacementItemId") REFERENCES "SessionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBill" ADD CONSTRAINT "CreditBill_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBill" ADD CONSTRAINT "CreditBill_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_creditBillId_fkey" FOREIGN KEY ("creditBillId") REFERENCES "CreditBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Manually added partial unique index for active table sessions
CREATE UNIQUE INDEX "idx_unique_active_table" ON "ServiceSession"("tableId") WHERE "tableId" IS NOT NULL AND "status" IN ('ACTIVE', 'SETTLING');
