-- Immutable Maison payment ledger. Stay totals remain on MaisonRecord.
CREATE TABLE "MaisonPayment" (
    "id" TEXT NOT NULL,
    "maisonRecordId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaisonPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaisonPayment_idempotencyKey_key" ON "MaisonPayment"("idempotencyKey");

CREATE INDEX "MaisonPayment_maisonRecordId_createdAt_idx" ON "MaisonPayment"("maisonRecordId", "createdAt");

ALTER TABLE "MaisonPayment" ADD CONSTRAINT "MaisonPayment_maisonRecordId_fkey" FOREIGN KEY ("maisonRecordId") REFERENCES "MaisonRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
