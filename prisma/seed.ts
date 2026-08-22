import "dotenv/config";
import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { TRACKED_CATEGORY_NAMES } from "../src/lib/stock";
import { bzenithMenu, itemVariants } from "./bzenith-menu";
import { splitName } from "../src/lib/staff";

const users: Array<{ name: string; email: string; role: Role }> = [
  { name: "B-ZENITH Administrator", email: "admin@example.com", role: "ADMIN" },
  { name: "B-ZENITH Owner", email: "owner@example.com", role: "OWNER" },
  { name: "Development Waiter", email: "waiter@example.com", role: "WAITER" },
  { name: "Jean Habimana", email: "inventory@example.com", role: "MANAGER" },
];

function sku(parts: string[]) {
  return parts
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isLocalDatabase(url = process.env.DATABASE_URL ?? "") {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function shouldSeedDevUsers() {
  if (process.env.NODE_ENV === "production") return false;
  if (!isLocalDatabase()) return false;
  return true;
}

async function main() {
  const seedDevUsers = shouldSeedDevUsers();

  if (seedDevUsers) {
    const passwordHash = await hash(process.env.SEED_USER_PASSWORD ?? "BZenith@2026", 12);
    const pinHash = await hash(process.env.SEED_USER_PIN ?? "2580", 12);
    for (const user of users) {
      const { firstName, lastName } = splitName(user.name);
      const username = user.email.split("@")[0]!;
      await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, firstName, lastName, username, role: user.role, active: true, pinHash, mustChangePin: false },
        create: { ...user, firstName, lastName, username, passwordHash, pinHash, mustChangePin: false },
      });
    }
  } else {
    console.log("Skipping development staff accounts. Production and remote databases never receive owner@example.com or BZenith@2026.");
  }

  const officialCategoryNames = bzenithMenu.map((category) => category.name);
  const categoryIds = new Map<string, string>();

  for (const [sortOrder, category] of bzenithMenu.entries()) {
    const record = await prisma.category.upsert({
      where: { name: category.name },
      update: { sortOrder, active: true },
      create: { name: category.name, sortOrder, active: true },
    });
    categoryIds.set(category.name, record.id);
  }

  await prisma.category.updateMany({
    where: { name: { notIn: officialCategoryNames } },
    data: { active: false },
  });

  let productCount = 0;
  let variantCount = 0;

  for (const category of bzenithMenu) {
    const categoryId = categoryIds.get(category.name);
    if (!categoryId) throw new Error(`Missing category ${category.name}`);

    for (const item of category.items) {
      const variants = itemVariants(item);
      const seedKey = `${category.name}::${item.name}`;
      const productSku = sku(["BZ", category.name, item.name]);
      const sellingPrice = variants[0]!.price;
      const unit = variants[0]!.unit;

      const trackInventory = (TRACKED_CATEGORY_NAMES as readonly string[]).includes(category.name);

      const product = await prisma.product.upsert({
        where: { seedKey },
        update: {
          categoryId,
          name: item.name,
          sku: productSku,
          description: item.description ?? null,
          sellingPrice,
          unit,
          active: true,
          trackInventory,
        },
        create: {
          seedKey,
          categoryId,
          name: item.name,
          sku: productSku,
          description: item.description ?? null,
          sellingPrice,
          unit,
          active: true,
          trackInventory,
          reorderLevel: trackInventory ? 5 : 0,
        },
      });
      productCount += 1;

      for (const [sortOrder, variant] of variants.entries()) {
        await prisma.productVariant.upsert({
          where: {
            productId_name: { productId: product.id, name: variant.name },
          },
          update: {
            sku: sku(["BZ", category.name, item.name, variant.name]),
            sellingPrice: variant.price,
            unit: variant.unit,
            active: true,
            sortOrder,
          },
          create: {
            productId: product.id,
            name: variant.name,
            sku: sku(["BZ", category.name, item.name, variant.name]),
            sellingPrice: variant.price,
            unit: variant.unit,
            active: true,
            sortOrder,
          },
        });
        variantCount += 1;
      }
    }
  }

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { businessName: "B-ZENITH", currency: "RWF", timezone: "Africa/Kigali" },
    create: {
      id: "default",
      businessName: "B-ZENITH",
      currency: "RWF",
      timezone: "Africa/Kigali",
      taxEnabled: false,
      taxRate: 0,
      receiptFooter: "Thank you for dining with us.",
    },
  });

  console.log(`Seeded ${officialCategoryNames.length} categories, ${productCount} products, ${variantCount} price variants.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
