import { loadEnvConfig } from "@next/env";
import { BusinessArea, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/services/orders";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";
import { cleanupInventoryArtifacts } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdTableIds: string[] = [];

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: createdOrderIds } },
      select: { id: true, orderNumber: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.inventoryMovement.deleteMany({
      where: {
        OR: [{ reference: { in: numbers } }, { productId: { in: createdProductIds } }],
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (createdProductIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({ where: { productId: { in: createdProductIds } } });
    await cleanupInventoryArtifacts(createdProductIds);
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
  if (createdTableIds.length > 0) {
    await prisma.serviceTable.deleteMany({ where: { id: { in: createdTableIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
  await prisma.$disconnect();
});

async function setupTrackedProduct(stockQuantity: number) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.create({
    data: { name: `Concurrent ${stamp}`, area: BusinessArea.BAR },
  });
  createdCategoryIds.push(category.id);

  const bar = await getLocationByCode(prisma, "BAR");
  const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
  const product = await prisma.product.create({
    data: {
      name: `Concurrent Lager ${stamp}`,
      categoryId: category.id,
      sellingPrice: 2000,
      trackInventory: true,
      stockQuantity,
      productType: ProductType.PACKAGED_GOOD,
      sellOnPos: true,
      defaultStockLocationId: bar.id,
      baseUnitId: bottle?.id,
      active: true,
    },
  });
  createdProductIds.push(product.id);
  await ensureTrackedProductStocks(prisma, product.id, 0);
  await prisma.productStock.update({
    where: { productId_locationId: { productId: product.id, locationId: bar.id } },
    data: { quantity: stockQuantity },
  });
  await syncCompatibilityStock(prisma, product.id);

  const table = await prisma.serviceTable.create({
    data: { name: `T ${stamp}`, active: true, sortOrder: 9000 },
  });
  createdTableIds.push(table.id);

  const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
  const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
  if (!john || !mary) {
    throw new Error("Seed data is required for this test (John, Mary).");
  }

  return { product, table, john, mary };
}

describe("concurrent tracked stock against the database", () => {
  it("deducts both simultaneous sales and never loses an update", async () => {
    const { product, table, john, mary } = await setupTrackedProduct(10);

    const [johnOrder, maryOrder] = await Promise.all([
      createOrder({
        waiterId: john.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 2 }],
        idempotencyKey: `concurrent-ok-john-${product.id}`,
      }),
      createOrder({
        waiterId: mary.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 3 }],
        idempotencyKey: `concurrent-ok-mary-${product.id}`,
      }),
    ]);
    createdOrderIds.push(johnOrder.id, maryOrder.id);

    const final = await prisma.product.findUnique({ where: { id: product.id } });
    expect(final?.stockQuantity).toBe(5);
    expect(johnOrder.id).not.toBe(maryOrder.id);

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: product.id, type: "SALE" },
    });
    expect(movements.reduce((sum, move) => sum + move.quantity, 0)).toBe(-5);
  });

  it("lets only one sale succeed when combined demand exceeds stock, and rolls the other back", async () => {
    const { product, table, john, mary } = await setupTrackedProduct(4);

    const results = await Promise.allSettled([
      createOrder({
        waiterId: john.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 3 }],
        idempotencyKey: `concurrent-fail-john-${product.id}`,
      }),
      createOrder({
        waiterId: mary.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 3 }],
        idempotencyKey: `concurrent-fail-mary-${product.id}`,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value;
    createdOrderIds.push(winner.id);

    const failed = rejected[0] as PromiseRejectedResult;
    expect(String(failed.reason)).toMatch(/Not enough Bar stock for Concurrent Lager/);
    expect(String(failed.reason)).toMatch(/Available: 1/);

    const final = await prisma.product.findUnique({ where: { id: product.id } });
    expect(final?.stockQuantity).toBe(1);
    expect(final!.stockQuantity).toBeGreaterThanOrEqual(0);

    const leftoverOrders = await prisma.order.findMany({
      where: {
        idempotencyKey: {
          in: [`concurrent-fail-john-${product.id}`, `concurrent-fail-mary-${product.id}`],
        },
      },
    });
    expect(leftoverOrders).toHaveLength(1);
    expect(leftoverOrders[0]?.id).toBe(winner.id);

    const items = await prisma.orderItem.findMany({ where: { productId: product.id } });
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);

    const movements = await prisma.inventoryMovement.findMany({ where: { productId: product.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe(-3);
  });

  it("replays the same idempotency key without deducting stock twice", async () => {
    const { product, table, john } = await setupTrackedProduct(10);
    const key = `concurrent-idempotent-${product.id}`;

    const [first, second] = await Promise.all([
      createOrder({
        waiterId: john.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 4 }],
        idempotencyKey: key,
      }),
      createOrder({
        waiterId: john.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 4 }],
        idempotencyKey: key,
      }),
    ]);
    createdOrderIds.push(first.id);

    expect(second.id).toBe(first.id);
    const copies = await prisma.order.findMany({ where: { idempotencyKey: key } });
    expect(copies).toHaveLength(1);

    const final = await prisma.product.findUnique({ where: { id: product.id } });
    expect(final?.stockQuantity).toBe(6);
  });
});
