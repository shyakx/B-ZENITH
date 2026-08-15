import "dotenv/config";
import { bzenithMenu } from "../prisma/bzenith-menu";
import { TRACKED_CATEGORY_NAMES } from "../src/lib/stock";
import { prisma } from "../src/lib/prisma";

async function main() {
  const official = bzenithMenu.map((category) => category.name);
  const extras = await prisma.category.findMany({
    where: { name: { notIn: official } },
    include: { _count: { select: { products: true } } },
  });

  const blocked = extras.filter((category) => category._count.products > 0);
  if (blocked.length) {
    throw new Error(`Refusing to delete categories that still have products: ${blocked.map((item) => item.name).join(", ")}`);
  }

  const deleted = await prisma.category.deleteMany({
    where: { id: { in: extras.map((category) => category.id) } },
  });

  const tracked = await prisma.product.updateMany({
    where: { category: { name: { in: [...TRACKED_CATEGORY_NAMES] } } },
    data: { trackInventory: true, reorderLevel: 5 },
  });

  const untracked = await prisma.product.updateMany({
    where: { category: { name: { notIn: [...TRACKED_CATEGORY_NAMES] } } },
    data: { trackInventory: false },
  });

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {
      businessName: "B-ZENITH",
      currency: "RWF",
      timezone: "Africa/Kigali",
      taxEnabled: false,
      taxRate: 0,
    },
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

  const remaining = await prisma.category.count();
  const products = await prisma.product.count();
  const variants = await prisma.productVariant.count();
  const trackedCount = await prisma.product.count({ where: { trackInventory: true } });

  console.log(JSON.stringify({
    ok: true,
    extraCategoriesRemoved: deleted.count,
    officialCategories: remaining,
    products,
    variants,
    trackedInventory: trackedCount,
    trackingEnabled: tracked.count,
    trackingDisabled: untracked.count,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
