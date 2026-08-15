ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Kigali';
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "defaultReorderLevel" INTEGER NOT NULL DEFAULT 5;
UPDATE "BusinessSettings" SET "receiptFooter" = 'Thank you for dining with us.' WHERE id = 'default' AND ("receiptFooter" = 'Thank you for your business.' OR "receiptFooter" IS NULL);
