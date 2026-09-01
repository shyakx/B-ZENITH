/**
 * DEVELOPMENT / TEST SEED ONLY.
 *
 * This script deletes existing rows and inserts demo staff, PINs, menu, and tables.
 * Do not run it against production. Use `prisma/production-setup.ts` instead.
 * Catalog definitions live in `prisma/catalog-data.ts` (shared with the
 * production catalog importer). Development seed still applies opening stock.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  CATALOG_CATEGORIES,
  assertCatalogIntegrity,
  flattenCatalogProducts,
} from "./catalog-data";

const prisma = new PrismaClient();

async function pin(value: string) {
  return bcrypt.hash(value, 10);
}

async function main() {
  console.log("Seeding B-ZENITH development data...");
  assertCatalogIntegrity();

  await prisma.auditLog.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.stockTransferLine.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.stockReceiptLine.deleteMany();
  await prisma.stockReceipt.deleteMany();
  await prisma.productPack.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.creditRecord.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.maisonRecord.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.serviceTable.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.orderSequence.deleteMany();

  await Promise.all([
    prisma.user.create({
      data: { name: "John", role: Role.WAITER, pinHash: await pin("1111") },
    }),
    prisma.user.create({
      data: { name: "Mary", role: Role.WAITER, pinHash: await pin("1112") },
    }),
    prisma.user.create({
      data: { name: "Grace", role: Role.CASHIER, pinHash: await pin("2222") },
    }),
    prisma.user.create({
      data: { name: "Patrick", role: Role.MANAGER, pinHash: await pin("3333") },
    }),
    prisma.user.create({
      data: { name: "Admin", role: Role.ADMIN, pinHash: await pin("4444") },
    }),
  ]);

  const tables = [
    ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
    "Bar 1",
    "Bar 2",
    "Terrace",
    "VIP",
    "Garden",
  ];
  for (const [index, name] of tables.entries()) {
    await prisma.serviceTable.create({ data: { name, sortOrder: index } });
  }

  const categoryIds: Record<string, string> = {};
  for (const [index, category] of CATALOG_CATEGORIES.entries()) {
    const row = await prisma.category.create({
      data: { name: category.name, area: category.area, sortOrder: index },
    });
    categoryIds[category.name] = row.id;
  }

  const [main, bar, kitchen, cafe, bottle, shot, glass, piece, kg, litre] = await Promise.all([
    prisma.stockLocation.findUnique({ where: { code: "MAIN" } }),
    prisma.stockLocation.findUnique({ where: { code: "BAR" } }),
    prisma.stockLocation.findUnique({ where: { code: "KITCHEN" } }),
    prisma.stockLocation.findUnique({ where: { code: "CAFE" } }),
    prisma.unit.findUnique({ where: { code: "BOTTLE" } }),
    prisma.unit.findUnique({ where: { code: "SHOT" } }),
    prisma.unit.findUnique({ where: { code: "GLASS" } }),
    prisma.unit.findUnique({ where: { code: "PIECE" } }),
    prisma.unit.findUnique({ where: { code: "KG" } }),
    prisma.unit.findUnique({ where: { code: "L" } }),
  ]);
  if (!main || !bar || !kitchen || !cafe || !bottle || !shot || !glass || !piece || !kg || !litre) {
    throw new Error("Run the location inventory migration before seeding (MAIN/BAR/KITCHEN/CAFE and units).");
  }

  const unitIds = {
    BOTTLE: bottle.id,
    SHOT: shot.id,
    GLASS: glass.id,
    PIECE: piece.id,
    KG: kg.id,
    L: litre.id,
  };
  const locationIds = { BAR: bar.id, KITCHEN: kitchen.id, CAFE: cafe.id };

  for (const product of flattenCatalogProducts()) {
    const categoryId = categoryIds[product.categoryName];
    if (!categoryId) throw new Error(`Missing category ${product.categoryName}`);
    const created = await prisma.product.create({
      data: {
        name: product.name,
        categoryId,
        sellingPrice: product.sellingPrice,
        trackInventory: product.trackInventory,
        stockQuantity: product.developmentStockQuantity,
        productType: product.productType,
        sellOnPos: product.sellOnPos,
        baseUnitId: unitIds[product.baseUnitCode],
        defaultStockLocationId: product.defaultLocationCode ? locationIds[product.defaultLocationCode] : null,
        sortOrder: product.sortOrder,
      },
    });
    if (product.trackInventory) {
      await prisma.productStock.createMany({
        data: [
          { productId: created.id, locationId: main.id, quantity: product.developmentStockQuantity },
          { productId: created.id, locationId: bar.id, quantity: 0 },
          { productId: created.id, locationId: kitchen.id, quantity: 0 },
          { productId: created.id, locationId: cafe.id, quantity: 0 },
        ],
      });
    }
  }

  await prisma.orderSequence.create({ data: { id: 1, value: 1000 } });

  await prisma.setting.createMany({
    data: [
      { key: "businessName", value: "B-ZENITH" },
      { key: "address", value: "Kigali, Rwanda" },
      { key: "phone", value: "" },
      { key: "tin", value: "" },
      { key: "receiptFooter", value: "Thank you for visiting B-ZENITH" },
    ],
  });

  console.log("Development seed complete.");
  console.log("Development credentials:");
  console.log("  John     Waiter   1111");
  console.log("  Mary     Waiter   1112");
  console.log("  Grace    Cashier  2222");
  console.log("  Patrick  Manager  3333");
  console.log("  Admin    Admin    4444");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
