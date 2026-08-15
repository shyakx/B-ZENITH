import { PosRegister } from "@/components/pos-register";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export default async function PosPage() {
  await requireUser(["OWNER", "ADMIN", "WAITER"]);
  const [categories, products, settings] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, products: { some: { active: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true, category: { active: true } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        trackInventory: true,
        categoryId: true,
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, sku: true, sellingPrice: true },
        },
      },
    }),
    prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }),
  ]);

  const sellable = products
    .filter((product) => product.variants.length > 0)
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      trackInventory: product.trackInventory,
      stockQuantity: product.stockQuantity,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        sellingPrice: variant.sellingPrice.toFixed(2),
      })),
    }));

  return (
    <PosRegister
      categories={categories}
      products={sellable}
      currency={settings.currency}
      taxRate={settings.taxEnabled ? settings.taxRate.toFixed(2) : "0.00"}
    />
  );
}
