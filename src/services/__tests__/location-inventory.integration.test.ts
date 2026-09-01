import { loadEnvConfig } from "@next/env";
import { BusinessArea, MovementType, PaymentStatus, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/roles";
import { KITCHEN_STORES_CATEGORY } from "@/lib/domain/kitchen-stores";
import { prisma } from "@/lib/prisma";
import { listPosCatalog, upsertProduct, ensureKitchenStoreCatalog } from "@/services/products";
import { cancelOrder, createOrder } from "@/services/orders";
import {
  adjustStock,
  countStock,
  receiveStock,
  recordWaste,
  transferStock,
  upsertProductPack,
} from "@/services/inventory";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";
import { setSupplierActive, upsertSupplier } from "@/services/suppliers";
import { cleanupInventoryArtifacts, setStock, stockAt } from "./inventory-helpers";

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
  const cashier = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!manager || !waiter || !cashier || !admin) {
    throw new Error("Seed staff is required (Patrick, John, Grace, Admin).");
  }
  return { manager, waiter, cashier, admin };
}

async function createTrackedDrink(name: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.create({
    data: { name: `Phase2 ${stamp}`, area: BusinessArea.KITCHEN },
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
    name: `Supplier ${Date.now()}`,
    userId: managerId,
  });
  createdSupplierIds.push(supplier.id);
  return supplier;
}

describe("phase 2 location inventory", () => {
  it("receives bottles into MAIN only (tests 1-2)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("Fanta");
    const supplier = await createSupplier(manager.id);
    const bar = await getLocationByCode(prisma, "BAR");

    const receipt = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `recv-1-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 100 }],
    });
    expect(receipt.location.code).toBe("MAIN");
    expect(await stockAt(product.id, "MAIN")).toBe(100);
    expect(await stockAt(product.id, "BAR")).toBe(0);
    expect(await stockAt(product.id, "KITCHEN")).toBe(0);
    expect(await stockAt(product.id, "CAFE")).toBe(0);

    await expect(
      receiveStock({
        supplierId: supplier.id,
        locationId: bar.id,
        userId: manager.id,
        idempotencyKey: `recv-bar-${product.id}`,
        lines: [{ productId: product.id, packQuantity: 5 }],
      }),
    ).rejects.toThrow(/Main Stock/);
    expect(await stockAt(product.id, "MAIN")).toBe(100);
    expect(await stockAt(product.id, "BAR")).toBe(0);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: `recv-bar-${product.id}` } })).toBe(0);
  });

  it("transfers MAIN to operational locations and rejects reverse/cross (tests 3-8)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("TransferDrink");
    await setStock(product.id, "MAIN", 100);
    const bar = await getLocationByCode(prisma, "BAR");
    const kitchen = await getLocationByCode(prisma, "KITCHEN");
    const cafe = await getLocationByCode(prisma, "CAFE");

    const toBar = await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: `tr-bar-${product.id}`,
      lines: [{ productId: product.id, baseQuantity: 30 }],
    });
    expect(await stockAt(product.id, "MAIN")).toBe(70);
    expect(await stockAt(product.id, "BAR")).toBe(30);
    const pair = await prisma.inventoryMovement.findMany({
      where: { transferId: toBar.id },
      orderBy: { type: "asc" },
    });
    expect(pair).toHaveLength(2);
    const out = pair.find((row) => row.type === MovementType.TRANSFER_OUT);
    const inn = pair.find((row) => row.type === MovementType.TRANSFER_IN);
    expect(out?.quantity).toBe(-30);
    expect(out?.locationId).toBe((await getLocationByCode(prisma, "MAIN")).id);
    expect(inn?.quantity).toBe(30);
    expect(inn?.locationId).toBe(bar.id);
    expect(out?.transferId).toBe(inn?.transferId);

    await expect(
      transferStock({
        toLocationId: bar.id,
        userId: manager.id,
        idempotencyKey: `tr-over-${product.id}`,
        lines: [{ productId: product.id, baseQuantity: 100 }],
      }),
    ).rejects.toThrow(/Not enough .* in Main Stock/);
    expect(await stockAt(product.id, "MAIN")).toBe(70);
    expect(await stockAt(product.id, "BAR")).toBe(30);
    expect(await prisma.stockTransfer.count({ where: { idempotencyKey: `tr-over-${product.id}` } })).toBe(0);

    await transferStock({
      toLocationId: kitchen.id,
      userId: manager.id,
      idempotencyKey: `tr-kit-${product.id}`,
      lines: [{ productId: product.id, baseQuantity: 5 }],
    });
    expect(await stockAt(product.id, "KITCHEN")).toBe(5);

    await transferStock({
      toLocationId: cafe.id,
      userId: manager.id,
      idempotencyKey: `tr-cafe-${product.id}`,
      lines: [{ productId: product.id, baseQuantity: 5 }],
    });
    expect(await stockAt(product.id, "CAFE")).toBe(5);

    await expect(
      transferStock({
        fromLocationId: bar.id,
        toLocationId: (await getLocationByCode(prisma, "MAIN")).id,
        userId: manager.id,
        idempotencyKey: `tr-reverse-${product.id}`,
        lines: [{ productId: product.id, baseQuantity: 1 }],
      }),
    ).rejects.toThrow(/Main Stock/);

    await expect(
      transferStock({
        fromLocationId: bar.id,
        toLocationId: kitchen.id,
        userId: manager.id,
        idempotencyKey: `tr-cross-${product.id}`,
        lines: [{ productId: product.id, baseQuantity: 1 }],
      }),
    ).rejects.toThrow(/Main Stock/);
  });

  it("sells from BAR not MAIN, voids unpaid only, and names the shortage (tests 9-12)", async () => {
    const { manager, waiter } = await staff();
    const product = await createTrackedDrink("FantaSale");
    await setStock(product.id, "MAIN", 70);
    await setStock(product.id, "BAR", 30);
    const table = await prisma.serviceTable.create({
      data: { name: `P2 ${Date.now()}`, active: true, sortOrder: 9100 },
    });
    createdTableIds.push(table.id);
    const bar = await getLocationByCode(prisma, "BAR");

    const order = await createOrder({
      waiterId: waiter.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `sale-1-${product.id}`,
    });
    createdOrderIds.push(order.id);
    expect(await stockAt(product.id, "BAR")).toBe(29);
    expect(await stockAt(product.id, "MAIN")).toBe(70);
    expect(order.items[0]?.stockLocationId).toBe(bar.id);
    const saleMove = await prisma.inventoryMovement.findFirst({
      where: { orderId: order.id, type: MovementType.SALE },
    });
    expect(saleMove?.locationId).toBe(bar.id);
    expect(saleMove?.quantity).toBe(-1);

    await expect(
      createOrder({
        waiterId: waiter.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 30 }],
        idempotencyKey: `sale-fail-${product.id}`,
      }),
    ).rejects.toThrow(/Not enough Bar stock/);
    expect(await stockAt(product.id, "BAR")).toBe(29);
    expect(await stockAt(product.id, "MAIN")).toBe(70);

    const voided = await cancelOrder({ orderId: order.id, userId: waiter.id, ownerWaiterId: waiter.id });
    expect(voided.status).toBe("CANCELLED");
    expect(await stockAt(product.id, "BAR")).toBe(30);
    expect(await stockAt(product.id, "MAIN")).toBe(70);
    const restore = await prisma.inventoryMovement.findFirst({
      where: { orderId: order.id, type: MovementType.VOID_RESTORE },
    });
    expect(restore?.locationId).toBe(bar.id);
    expect(restore?.quantity).toBe(1);

    const paid = await createOrder({
      waiterId: waiter.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `sale-paid-${product.id}`,
    });
    createdOrderIds.push(paid.id);
    await prisma.order.update({
      where: { id: paid.id },
      data: { paidAmount: paid.total, paymentStatus: PaymentStatus.PAID },
    });
    await expect(
      cancelOrder({ orderId: paid.id, userId: waiter.id, ownerWaiterId: waiter.id }),
    ).rejects.toThrow(/cannot be voided/);
    expect(await stockAt(product.id, "BAR")).toBe(29);
  });

  it("supports raw materials off POS (tests 13-15)", async () => {
    const { manager } = await staff();
    const category = await prisma.category.create({
      data: { name: `Raw ${Date.now()}`, area: BusinessArea.KITCHEN },
    });
    createdCategoryIds.push(category.id);
    const potatoes = await upsertProduct({
      name: `Potatoes ${Date.now()}`,
      categoryId: category.id,
      sellingPrice: 0,
      trackInventory: true,
      active: true,
      productType: ProductType.RAW_MATERIAL,
      userId: manager.id,
    });
    createdProductIds.push(potatoes.id);
    expect(potatoes.sellOnPos).toBe(false);
    const supplier = await createSupplier(manager.id);
    await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `pot-${potatoes.id}`,
      lines: [{ productId: potatoes.id, packQuantity: 20 }],
    });
    expect(await stockAt(potatoes.id, "MAIN")).toBe(20);
    const catalog = await listPosCatalog();
    expect(catalog.products.some((row) => row.id === potatoes.id)).toBe(false);

    const kitchen = await getLocationByCode(prisma, "KITCHEN");
    await transferStock({
      toLocationId: kitchen.id,
      userId: manager.id,
      idempotencyKey: `pot-tr-${potatoes.id}`,
      lines: [{ productId: potatoes.id, baseQuantity: 8 }],
    });
    expect(await stockAt(potatoes.id, "MAIN")).toBe(12);
    expect(await stockAt(potatoes.id, "KITCHEN")).toBe(8);

    await recordWaste({
      productId: potatoes.id,
      locationId: kitchen.id,
      quantity: 3,
      reason: "Spoiled potatoes",
      userId: manager.id,
    });
    expect(await stockAt(potatoes.id, "KITCHEN")).toBe(5);
    expect(await stockAt(potatoes.id, "MAIN")).toBe(12);
  });

  it("converts packs using ProductPack only (tests 16-19)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CrateFanta");
    const crate = await prisma.unit.findUnique({ where: { code: "CRATE" } });
    if (!crate) throw new Error("CRATE unit missing.");
    await expect(
      upsertProductPack({ productId: product.id, unitId: crate.id, baseQuantity: 0, userId: manager.id }),
    ).rejects.toThrow(/positive/);
    await expect(
      upsertProductPack({ productId: product.id, unitId: crate.id, baseQuantity: -4, userId: manager.id }),
    ).rejects.toThrow(/positive/);
    await upsertProductPack({
      productId: product.id,
      unitId: crate.id,
      baseQuantity: 30,
      userId: manager.id,
    });
    const supplier = await createSupplier(manager.id);
    await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `crate-${product.id}`,
      lines: [{ productId: product.id, packUnitId: crate.id, packQuantity: 2 }],
    });
    expect(await stockAt(product.id, "MAIN")).toBe(60);

    const other = await createTrackedDrink("NoPack");
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: `nopack-${other.id}`,
        lines: [{ productId: other.id, packUnitId: crate.id, packQuantity: 1 }],
      }),
    ).rejects.toThrow(/does not have a conversion/);
    expect(await stockAt(other.id, "MAIN")).toBe(0);
  });

  it("replays receipt and transfer idempotency keys (tests 20-21)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("Idem");
    const supplier = await createSupplier(manager.id);
    const key = `idem-recv-${product.id}`;
    const first = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: key,
      lines: [{ productId: product.id, packQuantity: 10 }],
    });
    const second = await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: key,
      lines: [{ productId: product.id, packQuantity: 10 }],
    });
    expect(second.id).toBe(first.id);
    expect(await stockAt(product.id, "MAIN")).toBe(10);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, type: MovementType.PURCHASE } })).toBe(1);

    const bar = await getLocationByCode(prisma, "BAR");
    const tKey = `idem-tr-${product.id}`;
    const a = await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: tKey,
      lines: [{ productId: product.id, baseQuantity: 4 }],
    });
    const b = await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: tKey,
      lines: [{ productId: product.id, baseQuantity: 4 }],
    });
    expect(b.id).toBe(a.id);
    expect(await stockAt(product.id, "MAIN")).toBe(6);
    expect(await stockAt(product.id, "BAR")).toBe(4);
    expect(await prisma.inventoryMovement.count({ where: { transferId: a.id } })).toBe(2);
  });

  it("serializes concurrent transfers without negative stock (test 22)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("ConcurrentTransfer");
    await setStock(product.id, "MAIN", 100);
    const bar = await getLocationByCode(prisma, "BAR");
    const results = await Promise.allSettled([
      transferStock({
        toLocationId: bar.id,
        userId: manager.id,
        idempotencyKey: `cta-${product.id}`,
        lines: [{ productId: product.id, baseQuantity: 70 }],
      }),
      transferStock({
        toLocationId: bar.id,
        userId: manager.id,
        idempotencyKey: `ctb-${product.id}`,
        lines: [{ productId: product.id, baseQuantity: 50 }],
      }),
    ]);
    const ok = results.filter((row) => row.status === "fulfilled");
    const fail = results.filter((row) => row.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    const main = await stockAt(product.id, "MAIN");
    const dest = await stockAt(product.id, "BAR");
    expect(main).toBeGreaterThanOrEqual(0);
    expect(main + dest).toBe(100);
    expect(dest).toBeLessThanOrEqual(100);
  });

  it("serializes concurrent BAR sales (test 23)", async () => {
    const { waiter } = await staff();
    const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
    if (!mary) throw new Error("Mary required.");
    const product = await createTrackedDrink("ConcurrentSale");
    await setStock(product.id, "BAR", 10);
    const table = await prisma.serviceTable.create({
      data: { name: `CS ${Date.now()}`, active: true, sortOrder: 9101 },
    });
    createdTableIds.push(table.id);
    const results = await Promise.allSettled([
      createOrder({
        waiterId: waiter.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 7 }],
        idempotencyKey: `csa-${product.id}`,
      }),
      createOrder({
        waiterId: mary.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 6 }],
        idempotencyKey: `csb-${product.id}`,
      }),
    ]);
    const ok = results.filter((row) => row.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
    ok.forEach((row) => createdOrderIds.push(row.value.id));
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const bar = await stockAt(product.id, "BAR");
    expect(bar).toBeGreaterThanOrEqual(0);
    expect(bar).toBeLessThanOrEqual(10);
  });

  it("counts, wastes, and adjusts by location (tests 24-29)", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("CountWaste");
    const bar = await getLocationByCode(prisma, "BAR");
    await setStock(product.id, "BAR", 30);
    await countStock({ productId: product.id, locationId: bar.id, counted: 25, userId: manager.id });
    expect(await stockAt(product.id, "BAR")).toBe(25);
    const countMove = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: MovementType.COUNT },
      orderBy: { createdAt: "desc" },
    });
    expect(countMove?.quantity).toBe(-5);
    await expect(
      countStock({ productId: product.id, locationId: bar.id, counted: -1, userId: manager.id }),
    ).rejects.toThrow(/below zero/);

    await setStock(product.id, "BAR", 10);
    await recordWaste({
      productId: product.id,
      locationId: bar.id,
      quantity: 5,
      reason: "Broken bottles",
      userId: manager.id,
    });
    expect(await stockAt(product.id, "BAR")).toBe(5);
    await setStock(product.id, "BAR", 10);
    await expect(
      recordWaste({
        productId: product.id,
        locationId: bar.id,
        quantity: 20,
        reason: "Too much waste",
        userId: manager.id,
      }),
    ).rejects.toThrow(/Not enough .* in Bar/);
    expect(await stockAt(product.id, "BAR")).toBe(10);

    await adjustStock({
      productId: product.id,
      locationId: bar.id,
      delta: 5,
      reason: "Found extra",
      userId: manager.id,
    });
    expect(await stockAt(product.id, "BAR")).toBe(15);
    await setStock(product.id, "BAR", 10);
    await expect(
      adjustStock({
        productId: product.id,
        locationId: bar.id,
        delta: -20,
        reason: "Would go negative",
        userId: manager.id,
      }),
    ).rejects.toThrow(/below zero/);
    expect(await stockAt(product.id, "BAR")).toBe(10);
  });

  it("backfills ProductStock from compatibility quantity without duplicating (tests 30-32)", async () => {
    const category = await prisma.category.create({
      data: { name: `Mig ${Date.now()}`, area: BusinessArea.BAR },
    });
    createdCategoryIds.push(category.id);
    const forty = await prisma.product.create({
      data: {
        name: `Legacy40 ${Date.now()}`,
        categoryId: category.id,
        sellingPrice: 1000,
        trackInventory: true,
        stockQuantity: 40,
        active: true,
      },
    });
    createdProductIds.push(forty.id);
    await ensureTrackedProductStocks(prisma, forty.id);
    expect(await stockAt(forty.id, "MAIN")).toBe(40);
    expect(await stockAt(forty.id, "BAR")).toBe(0);
    expect(await stockAt(forty.id, "KITCHEN")).toBe(0);
    expect(await stockAt(forty.id, "CAFE")).toBe(0);

    const zero = await prisma.product.create({
      data: {
        name: `Legacy0 ${Date.now()}`,
        categoryId: category.id,
        sellingPrice: 1000,
        trackInventory: true,
        stockQuantity: 0,
        active: true,
      },
    });
    createdProductIds.push(zero.id);
    await ensureTrackedProductStocks(prisma, zero.id);
    expect(await stockAt(zero.id, "MAIN")).toBe(0);
    expect(await stockAt(zero.id, "BAR")).toBe(0);

    await ensureTrackedProductStocks(prisma, forty.id);
    await ensureTrackedProductStocks(prisma, forty.id);
    expect(await prisma.productStock.count({ where: { productId: forty.id } })).toBe(4);
    expect(await prisma.stockLocation.count()).toBe(4);
    const unitCodes = await prisma.unit.findMany({ select: { code: true } });
    expect(new Set(unitCodes.map((row) => row.code)).size).toBe(unitCodes.length);
  });

  it("denies inventory transfers by role (tests 33-36)", async () => {
    const { manager, waiter, cashier, admin } = await staff();
    const product = await createTrackedDrink("Perms");
    await setStock(product.id, "MAIN", 10);
    const bar = await getLocationByCode(prisma, "BAR");
    const line = [{ productId: product.id, baseQuantity: 1 }];
    await expect(
      transferStock({ toLocationId: bar.id, userId: waiter.id, idempotencyKey: `p-w-${product.id}`, lines: line }),
    ).rejects.toThrow(/not allowed to manage inventory/);
    await expect(
      transferStock({ toLocationId: bar.id, userId: cashier.id, idempotencyKey: `p-c-${product.id}`, lines: line }),
    ).rejects.toThrow(/not allowed to manage inventory/);
    await transferStock({
      toLocationId: bar.id,
      userId: admin.id,
      idempotencyKey: `p-a-${product.id}`,
      lines: line,
    });
    await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: `p-m-${product.id}`,
      lines: line,
    });
    expect(await stockAt(product.id, "BAR")).toBe(2);
    expect(hasPermission("ADMIN", "manageInventory")).toBe(true);
    expect(hasPermission("MANAGER", "manageInventory")).toBe(true);
  });

  it("filters POS catalog by active and sellOnPos (tests 37-39)", async () => {
    const { manager } = await staff();
    const category = await prisma.category.create({
      data: { name: `POS ${Date.now()}`, area: BusinessArea.BAR },
    });
    createdCategoryIds.push(category.id);
    const raw = await upsertProduct({
      name: `Salt ${Date.now()}`,
      categoryId: category.id,
      sellingPrice: 0,
      trackInventory: true,
      active: true,
      productType: ProductType.RAW_MATERIAL,
      userId: manager.id,
    });
    createdProductIds.push(raw.id);
    const inactive = await upsertProduct({
      name: `Hidden ${Date.now()}`,
      categoryId: category.id,
      sellingPrice: 1000,
      trackInventory: false,
      active: false,
      sellOnPos: true,
      userId: manager.id,
    });
    createdProductIds.push(inactive.id);
    const packaged = await upsertProduct({
      name: `Visible ${Date.now()}`,
      categoryId: category.id,
      sellingPrice: 1500,
      trackInventory: true,
      active: true,
      productType: ProductType.PACKAGED_GOOD,
      sellOnPos: true,
      userId: manager.id,
    });
    createdProductIds.push(packaged.id);
    const catalog = await listPosCatalog();
    expect(catalog.products.some((row) => row.id === raw.id)).toBe(false);
    expect(catalog.products.some((row) => row.id === inactive.id)).toBe(false);
    expect(catalog.products.some((row) => row.id === packaged.id)).toBe(true);
  });

  it("keeps Product.stockQuantity equal to the sum of ProductStock", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("DualWrite");
    const supplier = await createSupplier(manager.id);
    await receiveStock({
      supplierId: supplier.id,
      userId: manager.id,
      idempotencyKey: `dw-recv-${product.id}`,
      lines: [{ productId: product.id, packQuantity: 40 }],
    });
    const afterReceive = await prisma.product.findUnique({ where: { id: product.id } });
    const receiveRows = await prisma.productStock.findMany({ where: { productId: product.id } });
    expect(afterReceive?.stockQuantity).toBe(receiveRows.reduce((sum, row) => sum + row.quantity, 0));
    expect(afterReceive?.stockQuantity).toBe(40);

    const bar = await getLocationByCode(prisma, "BAR");
    await transferStock({
      toLocationId: bar.id,
      userId: manager.id,
      idempotencyKey: `dw-tr-${product.id}`,
      lines: [{ productId: product.id, baseQuantity: 15 }],
    });
    const afterTransfer = await prisma.product.findUnique({ where: { id: product.id } });
    const transferRows = await prisma.productStock.findMany({ where: { productId: product.id } });
    expect(afterTransfer?.stockQuantity).toBe(transferRows.reduce((sum, row) => sum + row.quantity, 0));
    expect(await stockAt(product.id, "MAIN")).toBe(25);
    expect(await stockAt(product.id, "BAR")).toBe(15);
  });

  it("rejects receive from an inactive supplier", async () => {
    const { manager } = await staff();
    const product = await createTrackedDrink("InactiveSupplier");
    const supplier = await createSupplier(manager.id);
    await setSupplierActive({ id: supplier.id, active: false, userId: manager.id });
    await expect(
      receiveStock({
        supplierId: supplier.id,
        userId: manager.id,
        idempotencyKey: `inactive-${product.id}`,
        lines: [{ productId: product.id, packQuantity: 5 }],
      }),
    ).rejects.toThrow(/not active/);
    expect(await stockAt(product.id, "MAIN")).toBe(0);
    expect(await prisma.stockReceipt.count({ where: { idempotencyKey: `inactive-${product.id}` } })).toBe(0);
  });

  it("adds kitchen stores off POS and can receive them into Main Stock", async () => {
    const { manager } = await staff();
    const categoryBefore = await prisma.category.findUnique({ where: { name: KITCHEN_STORES_CATEGORY } });
    const beforeIds = new Set(
      (
        await prisma.product.findMany({
          where: { productType: ProductType.RAW_MATERIAL },
          select: { id: true },
        })
      ).map((row) => row.id),
    );

    await ensureKitchenStoreCatalog(manager.id);
    const rice = await prisma.product.findFirst({
      where: { name: "Rice", productType: ProductType.RAW_MATERIAL },
      include: { baseUnit: true, defaultStockLocation: true },
    });
    expect(rice).toBeTruthy();
    expect(rice?.sellOnPos).toBe(false);
    expect(rice?.trackInventory).toBe(true);
    expect(rice?.baseUnit?.code).toBe("KG");
    expect(rice?.defaultStockLocation?.code).toBe("KITCHEN");
    expect(await stockAt(rice!.id, "MAIN")).toBe(0);
    expect(await stockAt(rice!.id, "KITCHEN")).toBe(0);

    const catalog = await listPosCatalog();
    expect(catalog.products.some((row) => row.id === rice!.id)).toBe(false);

    const charcoal = await prisma.product.findFirst({
      where: { name: "Charcoal", productType: ProductType.RAW_MATERIAL },
    });
    expect(charcoal).toBeTruthy();

    const again = await ensureKitchenStoreCatalog(manager.id);
    expect(again.created).toBe(0);

    const created = await prisma.product.findMany({
      where: { productType: ProductType.RAW_MATERIAL },
      select: { id: true },
    });
    createdProductIds.push(...created.filter((row) => !beforeIds.has(row.id)).map((row) => row.id));
    if (!categoryBefore) {
      const category = await prisma.category.findUnique({ where: { name: KITCHEN_STORES_CATEGORY } });
      if (category) createdCategoryIds.push(category.id);
    }
  });
});
