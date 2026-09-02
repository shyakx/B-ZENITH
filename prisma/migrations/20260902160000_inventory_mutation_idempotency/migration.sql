-- Request-level idempotency for waste, count, and adjustment mutations.
-- Other movement types leave this null; PostgreSQL unique indexes allow multiple nulls.
ALTER TABLE "InventoryMovement" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");
