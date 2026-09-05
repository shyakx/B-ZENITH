-- Opening mode: waiters may sell before Bar/Kitchen counts are entered.
-- App still blocks oversell when ENFORCE_POS_STOCK=true.
ALTER TABLE "ProductStock" DROP CONSTRAINT IF EXISTS "ProductStock_quantity_nonnegative";
