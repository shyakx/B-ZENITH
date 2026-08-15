import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [users, categories, products, variants] = await Promise.all([
    prisma.user.findMany({ select: { email: true, role: true, active: true } }),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);

  const emails = users.map((user) => user.email).sort();
  if (!emails.includes("owner@example.com") || !emails.includes("waiter@example.com")) {
    throw new Error("Seed users are missing.");
  }
  if (users.some((user) => !user.active)) throw new Error("A seed user is inactive.");
  if (categories < 1 || products < 1 || variants < 1) throw new Error("Menu data is missing.");

  const variant = await prisma.productVariant.findFirst({
    where: { active: true, product: { active: true } },
    include: { product: true },
  });
  if (!variant) throw new Error("No sellable variant found.");

  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@example.com" } });
  const beforeStock = variant.product.stockQuantity;

  const sale = await prisma.$transaction(async (tx) => {
    const settings = await tx.businessSettings.upsert({
      where: { id: "default" },
      update: { receiptSequence: { increment: 1 } },
      create: { id: "default", receiptSequence: 1 },
    });
    const unitPrice = variant.sellingPrice;
    const created = await tx.sale.create({
      data: {
        receiptNumber: `E2E-${Date.now()}`,
        cashierId: owner.id,
        subtotal: unitPrice,
        tax: 0,
        total: unitPrice,
        amountPaid: unitPrice,
        paymentMethod: "CASH",
        items: {
          create: {
            productId: variant.productId,
            productVariantId: variant.id,
            productName: `${variant.product.name} (${variant.name})`,
            productSku: variant.sku,
            variantName: variant.name,
            unitPrice,
            unitCost: variant.product.costPrice,
            quantity: 1,
            lineSubtotal: unitPrice,
          },
        },
        payment: { create: { method: "CASH", amount: unitPrice, cashReceived: unitPrice, change: new Prisma.Decimal(0) } },
      },
    });
    if (variant.product.trackInventory) {
      await tx.product.update({ where: { id: variant.productId }, data: { stockQuantity: { decrement: 1 } } });
    }
    return created;
  });

  const after = await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } });
  if (variant.product.trackInventory && after.stockQuantity !== beforeStock - 1) {
    throw new Error("Inventory did not decrease after sale.");
  }

  const loaded = await prisma.sale.findUnique({
    where: { id: sale.id },
    include: { items: true, cashier: true },
  });
  if (!loaded?.items[0]?.productVariantId) throw new Error("Sale item is missing the selected variant.");
  if (!loaded.items[0].unitPrice.equals(variant.sellingPrice)) throw new Error("Sale used a price that was not from PostgreSQL.");

  console.log(JSON.stringify({
    ok: true,
    users: users.length,
    categories,
    products,
    variants,
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    variant: `${variant.product.name} / ${variant.name}`,
    price: variant.sellingPrice.toFixed(2),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
