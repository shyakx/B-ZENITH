-- CreateTable
CREATE TABLE "BusinessDayClose" (
    "id" TEXT NOT NULL,
    "businessDay" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT NOT NULL,
    "posCount" INTEGER NOT NULL,
    "posGross" DECIMAL(12,2) NOT NULL,
    "posNet" DECIMAL(12,2) NOT NULL,
    "billiardTotal" DECIMAL(12,2) NOT NULL,
    "expenseTotal" DECIMAL(12,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "BusinessDayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDayClose_businessDay_key" ON "BusinessDayClose"("businessDay");

-- CreateIndex
CREATE INDEX "BusinessDayClose_closedAt_idx" ON "BusinessDayClose"("closedAt");

-- AddForeignKey
ALTER TABLE "BusinessDayClose" ADD CONSTRAINT "BusinessDayClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
