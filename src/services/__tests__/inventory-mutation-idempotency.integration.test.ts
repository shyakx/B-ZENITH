import { loadEnvConfig } from "@next/env";
import { MovementType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { adjustStock, countStock, recordWaste } from "@/services/inventory";
import { cleanupInventoryArtifacts, createIsolatedPosProduct, setStock, stockAt } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];

afterAll(async () => {
  if (createdProductIds.length > 0) {
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: { in: createdProductIds } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...createdProductIds, ...movements.map((row) => row.id)] } },
    });
    await cleanupInventoryArtifacts(createdProductIds);
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
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
  if (!manager || !waiter || !cashier) {
    throw new Error("Seed staff is required (Patrick, John, Grace).");
  }
  return { manager, waiter, cashier };
}

async function isolatedProduct(barQuantity: number) {
  const isolated = await createIsolatedPosProduct({ barQuantity });
  createdProductIds.push(isolated.product.id);
  createdCategoryIds.push(isolated.category.id);
  return isolated;
}

async function movementCount(productId: string, type: MovementType) {
  return prisma.inventoryMovement.count({ where: { productId, type } });
}

describe("inventory mutation idempotency", () => {
  it("A records waste once", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId;
    if (!barId) throw new Error("BAR location missing.");

    const movement = await recordWaste({
      productId: product.id,
      locationId: barId,
      quantity: 3,
      reason: "Broken bottles",
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(await stockAt(product.id, "BAR")).toBe(7);
    expect(movement.type).toBe(MovementType.WASTE);
    expect(movement.quantity).toBe(-3);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(1);
  });

  it("B retries the same waste key without a second mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      quantity: 3,
      reason: "Broken bottles",
      userId: manager.id,
      idempotencyKey: key,
    };

    const first = await recordWaste(input);
    const second = await recordWaste(input);

    expect(second.id).toBe(first.id);
    expect(await stockAt(product.id, "BAR")).toBe(7);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(1);
  });

  it("C applies two legitimate waste operations with different keys", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;

    await recordWaste({
      productId: product.id,
      locationId: barId,
      quantity: 3,
      reason: "First waste",
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });
    await recordWaste({
      productId: product.id,
      locationId: barId,
      quantity: 2,
      reason: "Second waste",
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(await stockAt(product.id, "BAR")).toBe(5);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(2);
  });

  it("D retries the same positive adjustment key without a second mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      delta: 5,
      reason: "Found extra",
      userId: manager.id,
      idempotencyKey: key,
    };

    const first = await adjustStock(input);
    const second = await adjustStock(input);

    expect(second.id).toBe(first.id);
    expect(await stockAt(product.id, "BAR")).toBe(15);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(1);
  });

  it("E applies two legitimate adjustments with different keys", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;

    await adjustStock({
      productId: product.id,
      locationId: barId,
      delta: 5,
      reason: "Found extra",
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });
    await adjustStock({
      productId: product.id,
      locationId: barId,
      delta: 2,
      reason: "Found more",
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(await stockAt(product.id, "BAR")).toBe(17);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(2);
  });

  it("F retries the same negative adjustment key without a second mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      delta: -3,
      reason: "Correction",
      userId: manager.id,
      idempotencyKey: key,
    };

    const first = await adjustStock(input);
    const second = await adjustStock(input);

    expect(second.id).toBe(first.id);
    expect(await stockAt(product.id, "BAR")).toBe(7);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(1);
  });

  it("G retries the same count key without applying the count twice", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(20);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      counted: 17,
      userId: manager.id,
      idempotencyKey: key,
    };

    const first = await countStock(input);
    const second = await countStock(input);

    expect(second.id).toBe(first.id);
    expect(await stockAt(product.id, "BAR")).toBe(17);
    expect(await movementCount(product.id, MovementType.COUNT)).toBe(1);
  });

  it("H applies two legitimate counts with different keys", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(20);
    const barId = product.defaultStockLocationId!;

    await countStock({
      productId: product.id,
      locationId: barId,
      counted: 17,
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });
    await countStock({
      productId: product.id,
      locationId: barId,
      counted: 15,
      userId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(await stockAt(product.id, "BAR")).toBe(15);
    expect(await movementCount(product.id, MovementType.COUNT)).toBe(2);
  });

  it("I serializes concurrent same-key waste into one mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      quantity: 3,
      reason: "Concurrent waste",
      userId: manager.id,
      idempotencyKey: key,
    };

    const results = await Promise.all([recordWaste(input), recordWaste(input)]);

    expect(results[0].id).toBe(results[1].id);
    expect(await stockAt(product.id, "BAR")).toBe(7);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(1);
  });

  it("J serializes concurrent same-key adjustment into one mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      delta: 5,
      reason: "Concurrent adjustment",
      userId: manager.id,
      idempotencyKey: key,
    };

    const results = await Promise.all([adjustStock(input), adjustStock(input)]);

    expect(results[0].id).toBe(results[1].id);
    expect(await stockAt(product.id, "BAR")).toBe(15);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(1);
  });

  it("K serializes concurrent same-key count into one mutation", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(20);
    const barId = product.defaultStockLocationId!;
    const key = crypto.randomUUID();
    const input = {
      productId: product.id,
      locationId: barId,
      counted: 17,
      userId: manager.id,
      idempotencyKey: key,
    };

    const results = await Promise.all([countStock(input), countStock(input)]);

    expect(results[0].id).toBe(results[1].id);
    expect(await stockAt(product.id, "BAR")).toBe(17);
    expect(await movementCount(product.id, MovementType.COUNT)).toBe(1);
  });

  it("L applies concurrent different-key operations exactly once each", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;

    const results = await Promise.all([
      recordWaste({
        productId: product.id,
        locationId: barId,
        quantity: 3,
        reason: "Concurrent A",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
      recordWaste({
        productId: product.id,
        locationId: barId,
        quantity: 2,
        reason: "Concurrent B",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    expect(results[0].id).not.toBe(results[1].id);
    expect(await stockAt(product.id, "BAR")).toBe(5);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(2);
  });

  it("M rejects unauthorized users even with a valid-looking key", async () => {
    const { manager, waiter, cashier } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;
    const completedKey = crypto.randomUUID();

    await recordWaste({
      productId: product.id,
      locationId: barId,
      quantity: 1,
      reason: "Manager waste",
      userId: manager.id,
      idempotencyKey: completedKey,
    });

    await expect(
      recordWaste({
        productId: product.id,
        locationId: barId,
        quantity: 1,
        reason: "Waiter retry",
        userId: waiter.id,
        idempotencyKey: completedKey,
      }),
    ).rejects.toThrow(/not allowed to manage inventory/);

    await expect(
      adjustStock({
        productId: product.id,
        locationId: barId,
        delta: 2,
        reason: "Cashier adjust",
        userId: cashier.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/not allowed to manage inventory/);

    await expect(
      countStock({
        productId: product.id,
        locationId: barId,
        counted: 9,
        userId: waiter.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/not allowed to manage inventory/);

    expect(await stockAt(product.id, "BAR")).toBe(9);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(1);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(0);
    expect(await movementCount(product.id, MovementType.COUNT)).toBe(0);
  });

  it("N still rejects invalid quantities, products, and locations", async () => {
    const { manager } = await staff();
    const { product } = await isolatedProduct(10);
    const barId = product.defaultStockLocationId!;

    await expect(
      recordWaste({
        productId: product.id,
        locationId: barId,
        quantity: 3,
        reason: "No key",
        userId: manager.id,
        idempotencyKey: "   ",
      }),
    ).rejects.toThrow(/Missing waste key/);

    await expect(
      recordWaste({
        productId: "missing-product",
        locationId: barId,
        quantity: 1,
        reason: "Unknown product",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/Product not found/);

    await expect(
      recordWaste({
        productId: product.id,
        locationId: "missing-location",
        quantity: 1,
        reason: "Unknown location",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/choose where the stock is located/);

    await expect(
      recordWaste({
        productId: product.id,
        locationId: barId,
        quantity: 0,
        reason: "Zero waste",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/positive whole number/);

    await expect(
      countStock({
        productId: product.id,
        locationId: barId,
        counted: -1,
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/below zero/);

    await expect(
      adjustStock({
        productId: product.id,
        locationId: barId,
        delta: 0,
        reason: "Zero delta",
        userId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/non-zero whole number/);

    expect(await stockAt(product.id, "BAR")).toBe(10);
    expect(await movementCount(product.id, MovementType.WASTE)).toBe(0);
    expect(await movementCount(product.id, MovementType.COUNT)).toBe(0);
    expect(await movementCount(product.id, MovementType.ADJUSTMENT)).toBe(0);
  });
});
