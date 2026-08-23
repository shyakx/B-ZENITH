-- Additive only. Does not change existing product, sale, purchase, or user rows.
-- Locations MAIN_STOCK, BAR, and KITCHEN already exist from 20260823120000_inventory_locations.

ALTER TYPE "InventoryMovementType" ADD VALUE 'WASTE';

ALTER TABLE "InventoryMovement" ADD COLUMN "reason" TEXT;
