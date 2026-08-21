-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

UPDATE "User"
SET
  "firstName" = CASE
    WHEN position(' ' IN trim(both FROM "name")) > 0 THEN split_part(trim(both FROM "name"), ' ', 1)
    ELSE trim(both FROM "name")
  END,
  "lastName" = CASE
    WHEN position(' ' IN trim(both FROM "name")) > 0 THEN trim(both FROM substring(trim(both FROM "name") FROM position(' ' IN trim(both FROM "name"))))
    ELSE 'Staff'
  END,
  "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9.]+', '', 'g')),
  "mustChangePin" = ("pinHash" IS NULL);

UPDATE "User" SET "username" = 'user' || substr("id", 1, 8)
WHERE "username" IS NULL OR "username" = '';

WITH ranked AS (
  SELECT id, "username", ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") AS rn
  FROM "User"
)
UPDATE "User" AS u
SET "username" = ranked."username" || ranked.rn::text
FROM ranked
WHERE u.id = ranked.id AND ranked.rn > 1;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "AuditLog" ADD COLUMN "actorUsername" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" "Role";

UPDATE "AuditLog" AS a
SET
  "actorName" = u."name",
  "actorUsername" = u."username",
  "actorRole" = u."role"
FROM "User" AS u
WHERE a."userId" = u.id;

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
