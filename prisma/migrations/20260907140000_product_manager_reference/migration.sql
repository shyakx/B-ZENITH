-- Manager reference labels for products. Additive only — no stock/unit math changes.
ALTER TABLE "Product" ADD COLUMN "managerReferenceName" TEXT;
ALTER TABLE "Product" ADD COLUMN "managerReferenceNote" TEXT;
