-- OWNER is the business owner. ADMIN remains staff-control only.
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- Deleted staff keep their row so orders, payments, stock, and audit stay attributed.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
