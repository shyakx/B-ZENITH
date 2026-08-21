import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { splitName } from "../src/lib/staff";

const blockedEmails = new Set([
  "owner@example.com",
  "admin@example.com",
  "waiter@example.com",
  "inventory@example.com",
]);

async function main() {
  const name = process.env.OWNER_NAME?.trim();
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("Set OWNER_NAME, OWNER_EMAIL, and OWNER_PASSWORD for this one-time command. Do not use example.com accounts.");
  }
  if (blockedEmails.has(email) || email.endsWith("@example.com")) {
    throw new Error("Development example accounts cannot be created as the production owner.");
  }
  if (password === "BZenith@2026" || password.length < 8) {
    throw new Error("Choose a production owner password. Do not use BZenith@2026.");
  }

  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error("A user already exists. Create additional staff from Employees after signing in as OWNER.");
  }

  const { firstName, lastName } = splitName(name);
  const username = email.split("@")[0]!;
  const pin = process.env.OWNER_PIN?.trim();
  const owner = await prisma.user.create({
    data: {
      firstName,
      lastName,
      name,
      username,
      email,
      role: "OWNER",
      passwordHash: await hash(password, 12),
      ...(pin && pin.length === 4
        ? { pinHash: await hash(pin, 12), mustChangePin: true }
        : { mustChangePin: true }),
    },
  });

  console.log(`Created production owner ${owner.email}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
