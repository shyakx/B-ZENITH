import Link from "next/link";
import { InventoryOverview, type OverviewItem } from "@/components/inventory-overview";
import { requireUser } from "@/lib/authorization";
import { DELETED_PRODUCT_SKU_PREFIX } from "@/lib/catalog-fields";
import { availableTotal, totalsByProduct } from "@/lib/inventory-totals";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { catalogRoles } from "@/lib/roles";

export default async function InventoryPage() {
  await requireUser(catalogRoles);
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { NOT: { sku: { startsWith: DELETED_PRODUCT_SKU_PREFIX } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      include: { category: true, locationStocks: { include: { location: true } } },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: { select: { name: true } },
        location: { select: { code: true } },
        counterpartLocation: { select: { code: true } },
      },
    }),
  ]);

  const byProduct = new Map<string, typeof movements>();
  for (const movement of movements) {
    const list = byProduct.get(movement.productId) ?? [];
    list.push(movement);
    byProduct.set(movement.productId, list);
  }
  const ledgers = totalsByProduct(
    movements.map((movement) => ({
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
    })),
  );

  const items: OverviewItem[] = products.map((product) => {
    const qty = stockByLocation(product.locationStocks, [
      LOCATION_CODES.MAIN_STOCK,
      LOCATION_CODES.BAR,
      LOCATION_CODES.KITCHEN,
    ]);
    const ledger = ledgers.get(product.id) ?? {
      supplied: 0,
      wasted: 0,
      sold: 0,
      returned: 0,
      transferredOut: 0,
      transferredIn: 0,
      adjustments: 0,
    };
    const productMoves = byProduct.get(product.id) ?? [];
    const mappedMoves = productMoves.map((movement) => ({
      id: movement.id,
      createdAt: movement.createdAt.toISOString(),
      type: movement.type,
      quantity: movement.quantity,
      balanceAfter: movement.balanceAfter,
      locationCode: movement.location?.code ?? null,
      counterpartLocationCode: movement.counterpartLocation?.code ?? null,
      performedBy: movement.performedBy.name,
      note: movement.note,
      reason: movement.reason,
      referenceId: movement.referenceId,
    }));
    const lastAt = (code: string) => mappedMoves.find((move) => move.locationCode === code) ?? null;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: product.category.name,
      unit: product.unit,
      reorderLevel: product.reorderLevel,
      main: qty.MAIN_STOCK,
      bar: qty.BAR,
      kitchen: qty.KITCHEN,
      total: availableTotal(qty.MAIN_STOCK, qty.BAR, qty.KITCHEN),
      supplied: ledger.supplied,
      wasted: ledger.wasted,
      sold: ledger.sold,
      returned: ledger.returned,
      transferredOut: ledger.transferredOut,
      transferredIn: ledger.transferredIn,
      adjustments: ledger.adjustments,
      lastMain: lastAt("MAIN_STOCK"),
      lastBar: lastAt("BAR"),
      lastKitchen: lastAt("KITCHEN"),
      recent: mappedMoves.slice(0, 40),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Inventory</p>
          <h1 className="text-3xl font-black">Inventory overview</h1>
          <p className="mt-1 text-sm text-stone-500">
            Locations are MAIN STOCK, BAR, and KITCHEN. Categories such as Drinks stay on the product and are not warehouses.
          </p>
        </div>
        <Link href="/inventory/operations" className="grid min-h-11 place-items-center rounded-md bg-black px-4 font-bold text-[#d4af37]">
          Stock operations
        </Link>
      </div>
      <InventoryOverview items={items} />
    </div>
  );
}
