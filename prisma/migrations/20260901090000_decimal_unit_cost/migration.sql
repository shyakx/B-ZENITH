-- Allow fractional last-cost unit prices. Stock quantities stay integer.
ALTER TABLE "Product" ALTER COLUMN "costPrice" TYPE DECIMAL(19,10);
ALTER TABLE "StockReceiptLine" ALTER COLUMN "unitCost" TYPE DECIMAL(19,10);
