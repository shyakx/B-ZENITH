import { PosRegister } from "@/components/pos-register";
import { requireUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function PosPage() {
  await requireUser(tillRoles);
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
        sellingLocationId: true,
        locationStocks: { include: { location: { select: { id: true, code: true } } } },
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
      stockQuantity:
        product.locationStocks.find((row) => row.locationId === product.sellingLocationId)?.quantity ??
        product.locationStocks.find((row) => row.location.code === "BAR")?.quantity ??
        product.stockQuantity,
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
