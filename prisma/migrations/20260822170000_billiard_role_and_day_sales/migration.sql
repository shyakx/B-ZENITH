-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'BILLIARD';

-- CreateTable
CREATE TABLE "BilliardDaySale" (
    "id" TEXT NOT NULL,
    "businessDay" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BilliardDaySale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BilliardDaySale_businessDay_idx" ON "BilliardDaySale"("businessDay");

-- CreateIndex
CREATE UNIQUE INDEX "BilliardDaySale_businessDay_operatorId_key" ON "BilliardDaySale"("businessDay", "operatorId");

-- AddForeignKey
ALTER TABLE "BilliardDaySale" ADD CONSTRAINT "BilliardDaySale_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
