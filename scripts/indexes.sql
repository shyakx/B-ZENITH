CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");
CREATE INDEX IF NOT EXISTS "Product_trackInventory_stockQuantity_idx" ON "Product"("trackInventory", "stockQuantity");
CREATE INDEX IF NOT EXISTS "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_paymentMethod_createdAt_idx" ON "Sale"("paymentMethod", "createdAt");
CREATE INDEX IF NOT EXISTS "Purchase_createdAt_idx" ON "Purchase"("createdAt");
CREATE INDEX IF NOT EXISTS "Purchase_status_idx" ON "Purchase"("status");
