import { InventoryOverview, type OverviewItem, type InventoryActivity } from "@/components/inventory-overview";
import { requireUser } from "@/lib/authorization";
import { DELETED_PRODUCT_SKU_PREFIX } from "@/lib/catalog-fields";
import { canEditInventory } from "@/lib/inventory-auth";
import { availableTotal, totalsByProduct } from "@/lib/inventory-totals";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { stockViewRoles } from "@/lib/roles";

export default async function InventoryPage() {
  const user = await requireUser(stockViewRoles);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [products, movements, recentMovementCount] = await Promise.all([
    prisma.product.findMany({
      where: { NOT: { sku: { startsWith: DELETED_PRODUCT_SKU_PREFIX } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      include: { category: true, locationStocks: { include: { location: true } } },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true } },
        performedBy: { select: { name: true } },
        location: { select: { code: true } },
        counterpartLocation: { select: { code: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: { createdAt: { gte: weekAgo } } }),
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
      seedKey: product.seedKey,
      unit: product.unit,
      costPrice: product.costPrice.toNumber(),
      trackInventory: product.trackInventory,
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

  const activity: InventoryActivity[] = movements.slice(0, 25).map((movement) => ({
    id: movement.id,
    createdAt: movement.createdAt.toISOString(),
    productName: movement.product.name,
    type: movement.type,
    quantity: movement.quantity,
    balanceAfter: movement.balanceAfter,
    locationCode: movement.location?.code ?? null,
    performedBy: movement.performedBy.name,
    referenceId: movement.referenceId,
  }));

  return (
    <InventoryOverview
      items={items}
      activity={activity}
      recentMovementCount={recentMovementCount}
      canManage={canEditInventory(user.role)}
    />
  );
}
