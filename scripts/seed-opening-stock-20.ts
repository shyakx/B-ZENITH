/**
 * Opening stock seed:
 * - MAIN: 20 for every tracked product
 * - BAR: 20 for bar/packaged products only
 * - KITCHEN: 20 for kitchen/raw products only
 * - Clears the wrong operational location (Bar drinks → Kitchen 0, kitchen stores → Bar 0)
 *
 * Usage:
 *   CONFIRM_OPENING_STOCK=YES npx tsx scripts/seed-opening-stock-20.ts
 */
import { PrismaClient, ProductType } from "@prisma/client";

const QUANTITY = 20;
const prisma = new PrismaClient();

function isKitchenProduct(product: {
  productType: ProductType;
  defaultStockLocation: { code: string } | null;
}) {
  return (
    product.productType === ProductType.RAW_MATERIAL ||
    product.defaultStockLocation?.code === "KITCHEN"
  );
}

async function main() {
  if (process.env.CONFIRM_OPENING_STOCK !== "YES") {
    throw new Error("Refusing to run. Set CONFIRM_OPENING_STOCK=YES to set opening stock.");
  }

  const locations = await prisma.stockLocation.findMany({
    where: { code: { in: ["MAIN", "BAR", "KITCHEN"] }, active: true },
    select: { id: true, code: true, name: true },
  });
  const byCode = Object.fromEntries(locations.map((location) => [location.code, location]));
  if (!byCode.MAIN || !byCode.BAR || !byCode.KITCHEN) {
    throw new Error("MAIN, BAR, and KITCHEN locations are required.");
  }

  const products = await prisma.product.findMany({
    where: { trackInventory: true },
    select: {
      id: true,
      name: true,
      productType: true,
      defaultStockLocation: { select: { code: true } },
    },
    orderBy: { name: "asc" },
  });

  let kitchenProducts = 0;
  let barProducts = 0;

  for (const product of products) {
    const kitchen = isKitchenProduct(product);
    if (kitchen) kitchenProducts += 1;
    else barProducts += 1;

    const targets: { locationId: string; quantity: number }[] = [
      { locationId: byCode.MAIN.id, quantity: QUANTITY },
      {
        locationId: byCode.BAR.id,
        quantity: kitchen ? 0 : QUANTITY,
      },
      {
        locationId: byCode.KITCHEN.id,
        quantity: kitchen ? QUANTITY : 0,
      },
    ];

    for (const target of targets) {
      await prisma.productStock.upsert({
        where: {
          productId_locationId: { productId: product.id, locationId: target.locationId },
        },
        update: { quantity: target.quantity },
        create: {
          productId: product.id,
          locationId: target.locationId,
          quantity: target.quantity,
        },
      });
    }

    const rows = await prisma.productStock.findMany({
      where: { productId: product.id },
      select: { quantity: true },
    });
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: total },
    });
  }

  const drinkSample = await prisma.productStock.findMany({
    where: {
      product: { trackInventory: true, productType: ProductType.PACKAGED_GOOD },
      location: { code: { in: ["MAIN", "BAR", "KITCHEN"] } },
    },
    take: 6,
    include: { product: { select: { name: true } }, location: { select: { code: true } } },
    orderBy: [{ product: { name: "asc" } }, { location: { code: "asc" } }],
  });
  const kitchenSample = await prisma.productStock.findMany({
    where: {
      product: { trackInventory: true, productType: ProductType.RAW_MATERIAL },
      location: { code: { in: ["MAIN", "BAR", "KITCHEN"] } },
    },
    take: 6,
    include: { product: { select: { name: true } }, location: { select: { code: true } } },
    orderBy: [{ product: { name: "asc" } }, { location: { code: "asc" } }],
  });

  console.log(
    JSON.stringify(
      {
        products: products.length,
        barProducts,
        kitchenProducts,
        quantity: QUANTITY,
        drinkSample: drinkSample.map((row) => ({
          product: row.product.name,
          location: row.location.code,
          quantity: row.quantity,
        })),
        kitchenSample: kitchenSample.map((row) => ({
          product: row.product.name,
          location: row.location.code,
          quantity: row.quantity,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
