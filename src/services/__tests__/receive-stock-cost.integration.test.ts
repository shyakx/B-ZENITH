import { loadEnvConfig } from "@next/env";
import { BusinessArea, MovementType, Prisma, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { unitCostFromTotalPrice } from "@/lib/domain/money";
import { createOrder } from "@/services/orders";
import { receiveStock, transferStock, upsertProductPack } from "@/services/inventory";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";
import { upsertSupplier } from "@/services/suppliers";
import { cleanupInventoryArtifacts, stockAt } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdTableIds: string[] = [];
const createdOrderIds: string[] = [];
const createdSupplierIds: string[] = [];

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: createdOrderIds } },
      select: { id: true, orderNumber: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.inventoryMovement.deleteMany({
      where: { OR: [{ reference: { in: numbers } }, { orderId: { in: createdOrderIds } }] },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await cleanupInventoryArtifacts(createdProductIds);
  if (createdSupplierIds.length > 0) {
    await prisma.stockReceipt.deleteMany({ where: { supplierId: { in: createdSupplierIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdSupplierIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
  }
  if (createdProductIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdProductIds } } });
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

async function staff() {
  const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
  const waiter = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
  if (!manager || !waiter) throw new Error("Seed staff is required (Patrick, John).");
  return { manager, waiter };
}

async function createTrackedDrink(name: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.create({
    data: { name: `Cost ${stamp}`, area: BusinessArea.KITCHEN },
  });
  createdCategoryIds.push(category.id);
  const bar = await getLocationByCode(prisma, "BAR");
  const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
  const product = await prisma.product.create({
    data: {
      name: `${name} ${stamp}`,
      categoryId: category.id,
      sellingPrice: 1500,
      costPrice: 800,
      trackInventory: true,
      productType: ProductType.PACKAGED_GOOD,
      sellOnPos: true,
      stockQuantity: 0,
      defaultStockLocationId: bar.id,
      baseUnitId: bottle?.id,
      active: true,
    },
  });
  createdProductIds.push(product.id);
  await ensureTrackedProductStocks(prisma, product.id, 0);
  await syncCompatibilityStock(prisma, product.id);
  return product;
}

async function createSupplier(managerId: string) {
  const supplier = await upsertSupplier({
    name: `Cost Supplier ${Date.now()}`,
    userId: managerId,
  });
  createdSupplierIds.push(supplier.id);
  return supplier;
}

function expectCost(actual: Prisma.Decimal | null | undefined, expected: Prisma.Decimal | number) {
  expect(actual).not.toBeNull();
  expect(
    new Prisma.Decimal(actual!).toDecimalPlaces(10).eq(new Prisma.Decimal(expected).toDecimalPlaces(10)),
  ).toBe(true);
}

async function locationSnapshot(productId: string) {
  return {
    MAIN: await stockAt(productId, "MAIN"),
    BAR: await stockAt(productId, "BAR"),
    KITCHEN: await stockAt(productId, "KITCHEN"),
    CAFE: await stockAt(productId, "CAFE"),
  };
}

describe("receive stock fractional last cost", () => {
  it("TEST 1: 1 bottle at 2,500 RWF stores unit cost 2,500", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostOne");
    const supplier = await createSupplier(manager.id);
    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-1-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 1, packCost: 2500 }],
    });
    expectCost(receipt.lines[0]?.unitCost, 2500);
    expect(receipt.lines[0]?.baseQuantity).toBe(1);
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expectCost(updated?.costPrice, 2500);
    expect(await stockAt(product.id, "MAIN")).toBe(1);
  });

  it("TEST 2: 40 bottles at 100,000 RWF stores unit cost 2,500", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostForty");
    const supplier = await createSupplier(manager.id);
    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-2-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 40, packCost: 100000 }],
    });
    expectCost(receipt.lines[0]?.unitCost, 2500);
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expectCost(updated?.costPrice, 2500);
    expect(await stockAt(product.id, "MAIN")).toBe(40);
  });

  it("TEST 3: 60 bottles at 100,000 RWF stores fractional unit cost", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostSixty");
    const supplier = await createSupplier(manager.id);
    const expected = unitCostFromTotalPrice(100000, 60);
    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-3-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    expect(receipt.lines[0]?.baseQuantity).toBe(60);
    expectCost(receipt.lines[0]?.unitCost, expected);
    expect(Number(receipt.lines[0]?.unitCost)).toBeCloseTo(1666.666666, 5);
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expectCost(updated?.costPrice, expected);
    expect(await stockAt(product.id, "MAIN")).toBe(60);
  });

  it("TEST 4: 3 crates of 20 bottles at 100,000 RWF convert to 60 bottles", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostCrate");
    const crate = await prisma.unit.findUnique({ where: { code: "CRATE" } });
    if (!crate) throw new Error("CRATE unit is required.");
    await upsertProductPack({
      productId: product.id,
      unitId: crate.id,
      baseQuantity: 20,
      userId: manager.id,
    });
    const supplier = await createSupplier(manager.id);
    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-4-${product.id}`,
      lines: [{ productId: product.id, packUnitId: crate.id, packQuantity: 3, packCost: 100000 }],
    });
    expect(receipt.lines[0]?.baseQuantity).toBe(60);
    expectCost(receipt.lines[0]?.unitCost, unitCostFromTotalPrice(100000, 60));
    expect(await stockAt(product.id, "MAIN")).toBe(60);
  });

  it("TEST 5: total price 0 is rejected with no stock change", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostZero");
    const supplier = await createSupplier(manager.id);
    const before = await locationSnapshot(product.id);
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: `cost-5-${product.id}`,
        lines: [{ productId: product.id, packQuantity: 60, packCost: 0 }],
      }),
    ).rejects.toThrow(/Price paid must be greater than 0/);
    expect(await locationSnapshot(product.id)).toEqual(before);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: `cost-5-${product.id}` } })).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(0);
  });

  it("TEST 6: negative total price is rejected with no stock change", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostNeg");
    const supplier = await createSupplier(manager.id);
    const before = await locationSnapshot(product.id);
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: `cost-6-${product.id}`,
        lines: [{ productId: product.id, packQuantity: 60, packCost: -100000 }],
      }),
    ).rejects.toThrow(/Price paid must be greater than 0/);
    expect(await locationSnapshot(product.id)).toEqual(before);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: `cost-6-${product.id}` } })).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(0);
  });

  it("TEST 7: quantity 0 is rejected with no stock change", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostQty0");
    const supplier = await createSupplier(manager.id);
    const before = await locationSnapshot(product.id);
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: `cost-7-${product.id}`,
        lines: [{ productId: product.id, packQuantity: 0, packCost: 100000 }],
      }),
    ).rejects.toThrow(/positive/);
    expect(await locationSnapshot(product.id)).toEqual(before);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: `cost-7-${product.id}` } })).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(0);
  });

  it("TEST 8: a non-divisible total price is accepted", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostNondiv");
    const supplier = await createSupplier(manager.id);
    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-8-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    expect(receipt.lines[0]?.baseQuantity).toBe(60);
    expectCost(receipt.lines[0]?.unitCost, unitCostFromTotalPrice(100000, 60));
    expect(await stockAt(product.id, "MAIN")).toBe(60);
  });

  it("TEST 9: repeating the same receipt key does not double stock", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostIdem");
    const supplier = await createSupplier(manager.id);
    const key = `cost-9-${product.id}`;
    const first = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: key,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    const second = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: key,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    expect(second.id).toBe(first.id);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(await stockAt(product.id, "MAIN")).toBe(60);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, type: MovementType.PURCHASE } })).toBe(
      1,
    );
  });

  it("TEST 10: a later line error rolls back the whole receipt", async () => {
    const { manager } = await staff();
    const tracked = await createTrackedDrink("CostTxOk");
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: { name: `Untracked ${stamp}`, area: BusinessArea.KITCHEN },
    });
    createdCategoryIds.push(category.id);
    const untracked = await prisma.product.create({
      data: {
        name: `Untracked ${stamp}`,
        categoryId: category.id,
        sellingPrice: 1000,
        trackInventory: false,
        productType: ProductType.MENU_ITEM,
        sellOnPos: true,
        active: true,
      },
    });
    createdProductIds.push(untracked.id);
    const supplier = await createSupplier(manager.id);
    const key = `cost-10-${tracked.id}`;
    const before = await locationSnapshot(tracked.id);
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: key,
        lines: [
          { productId: tracked.id, packQuantity: 60, packCost: 100000 },
          { productId: untracked.id, packQuantity: 1, packCost: 1000 },
        ],
      }),
    ).rejects.toThrow(/does not track inventory/);
    expect(await locationSnapshot(tracked.id)).toEqual(before);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: key } })).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: tracked.id } })).toBe(0);
    expect(await prisma.stockReceiptLine.count({ where: { productId: tracked.id } })).toBe(0);
  });

  it("TEST 11: receive increases MAIN only", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CostMainOnly");
    const supplier = await createSupplier(manager.id);
    const before = await locationSnapshot(product.id);
    await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-11-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    expect(await stockAt(product.id, "MAIN")).toBe(before.MAIN + 60);
    expect(await stockAt(product.id, "BAR")).toBe(before.BAR);
    expect(await stockAt(product.id, "KITCHEN")).toBe(before.KITCHEN);
    expect(await stockAt(product.id, "CAFE")).toBe(before.CAFE);
  });

  it("TEST 12: receive MAIN, transfer to BAR, sell from BAR", async () => {
    const { manager, waiter } = await staff();
    const product = await createTrackedDrink("CostFlow");
    const supplier = await createSupplier(manager.id);
    await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `cost-12-recv-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 60, packCost: 100000 }],
    });
    expect(await stockAt(product.id, "MAIN")).toBe(60);
    const bar = await getLocationByCode(prisma, "BAR");
    await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: `cost-12-tr-${product.id}`,
      lines: [{ productId: product.id, baseQuantity: 10 }],
    });
    expect(await stockAt(product.id, "MAIN")).toBe(50);
    expect(await stockAt(product.id, "BAR")).toBe(10);
    expect(await stockAt(product.id, "KITCHEN")).toBe(0);
    expect(await stockAt(product.id, "CAFE")).toBe(0);
    const table = await prisma.serviceTable.create({
      data: { name: `Cost ${Date.now()}`, active: true, sortOrder: 9200 },
    });
    createdTableIds.push(table.id);
    const order = await createOrder({
      waiterId: waiter.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cost-12-sale-${product.id}`,
    });
    createdOrderIds.push(order.id);
    expect(await stockAt(product.id, "BAR")).toBe(9);
    expect(await stockAt(product.id, "MAIN")).toBe(50);
    expect(order.items[0]?.stockLocationId).toBe(bar.id);
  });
});
