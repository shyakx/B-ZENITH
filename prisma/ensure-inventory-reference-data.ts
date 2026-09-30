import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { ensureInventoryReferenceData } from "./inventory-reference-data";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

ensureInventoryReferenceData(prisma)
  .then(() => console.log("Inventory locations and units are ready."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());