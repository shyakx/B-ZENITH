-- Restore the non-negative guard. Opening mode no longer writes negative stock;
-- POS simply skips inventory until ENFORCE_POS_STOCK=true.
UPDATE "ProductStock" SET "quantity" = 0 WHERE "quantity" < 0;
ALTER TABLE "ProductStock" DROP CONSTRAINT IF EXISTS "ProductStock_quantity_nonnegative";
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_quantity_nonnegative" CHECK ("quantity" >= 0);
