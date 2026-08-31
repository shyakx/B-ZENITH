/**
 * Production-safe, non-destructive baseline setup.
 *
 * Never run prisma/seed.ts against production. That script deletes data
 * and inserts development staff/PINs.
 *
 * This script only creates missing required records:
 * - OrderSequence id=1 (does not change an existing value)
 * - Setting keys from application defaults (does not overwrite existing values)
 * - Optional first Admin, only when INITIAL_ADMIN_NAME and INITIAL_ADMIN_PIN
 *   are both supplied and no Admin already exists
 *
 * Optional environment:
 *   INITIAL_ORDER_SEQUENCE_START  used only when creating OrderSequence
 *     (current default 1000 — confirm before production cutover)
 *   INITIAL_ADMIN_NAME
 *   INITIAL_ADMIN_PIN  never logged or printed
 */

import { PrismaClient, Role } from "@prisma/client";
import { hashPin, isValidPin } from "../src/lib/auth/pin";

const DEFAULT_ORDER_SEQUENCE_START = 1000;

const DEFAULT_SETTING_VALUES: Record<string, string> = {
  businessName: "B-ZENITH",
  address: "Kigali, Rwanda",
  phone: "",
  tin: "",
  receiptFooter: "Thank you for visiting B-ZENITH",
};

const prisma = new PrismaClient();

function parseOrderSequenceStart(): number {
  const raw = process.env.INITIAL_ORDER_SEQUENCE_START;
  if (raw == null || raw.trim() === "") {
    return DEFAULT_ORDER_SEQUENCE_START;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("INITIAL_ORDER_SEQUENCE_START must be a non-negative integer.");
  }
  return value;
}

async function ensureOrderSequence() {
  const existing = await prisma.orderSequence.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log(`OrderSequence id=1 already exists (value left unchanged).`);
    return;
  }
  const start = parseOrderSequenceStart();
  await prisma.orderSequence.create({
    data: { id: 1, value: start },
  });
  console.log(`Created OrderSequence id=1 with starting value ${start}.`);
}

async function ensureSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTING_VALUES)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) {
      console.log(`Setting "${key}" already exists (value left unchanged).`);
      continue;
    }
    await prisma.setting.create({ data: { key, value } });
    console.log(`Created missing setting "${key}".`);
  }
}

async function maybeCreateInitialAdmin() {
  const nameRaw = process.env.INITIAL_ADMIN_NAME;
  const pinRaw = process.env.INITIAL_ADMIN_PIN;
  const nameProvided = Boolean(nameRaw && nameRaw.trim());
  const pinProvided = Boolean(pinRaw && pinRaw.trim());

  if (!nameProvided && !pinProvided) {
    console.log("INITIAL_ADMIN_NAME / INITIAL_ADMIN_PIN not set; skipping Admin creation.");
    return;
  }
  if (nameProvided !== pinProvided) {
    throw new Error("INITIAL_ADMIN_NAME and INITIAL_ADMIN_PIN must both be set together.");
  }

  const name = nameRaw!.trim();
  const pin = pinRaw!.trim();
  if (name.length < 2) {
    throw new Error("INITIAL_ADMIN_NAME must be at least 2 characters.");
  }
  if (!isValidPin(pin)) {
    throw new Error("INITIAL_ADMIN_PIN must be 4 to 6 digits.");
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });
  if (existingAdmin) {
    console.log("An Admin account already exists; skipping Admin creation.");
    return;
  }

  await prisma.user.create({
    data: {
      name,
      role: Role.ADMIN,
      pinHash: await hashPin(pin),
    },
  });
  console.log("Created initial Admin account.");
}

async function main() {
  console.log("Running production-safe database setup (non-destructive)...");
  await ensureOrderSequence();
  await ensureSettings();
  await maybeCreateInitialAdmin();
  console.log("Production setup complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
