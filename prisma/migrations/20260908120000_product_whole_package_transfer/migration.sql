-- Additive only: default false so existing products keep bottle/kg transfer behavior.
ALTER TABLE "Product" ADD COLUMN "wholePackageTransfer" BOOLEAN NOT NULL DEFAULT false;
