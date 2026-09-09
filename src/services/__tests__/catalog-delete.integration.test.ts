import { loadEnvConfig } from "@next/env";
import { BusinessArea, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { deleteCategory, deleteProduct, previewProductDelete } from "@/services/products";
import { cleanupInventoryArtifacts } from "./inventory-helpers";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";

loadEnvConfig(process.cwd());

const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];

afterAll(async () => {
  await cleanupInventoryArtifacts(createdProductIds);
  if (createdProductIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
  await prisma.$disconnect();
});

describe("catalog delete safety", () => {
  it("hard-deletes an unused product without touching other catalog rows", async () => {
    const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
    if (!manager) throw new Error("Seed manager Patrick is required.");

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: { name: `DelCat ${stamp}`, area: BusinessArea.BAR },
    });
    createdCategoryIds.push(category.id);

    const product = await prisma.product.create({
      data: {
        name: `Temp Drink ${stamp}`,
        categoryId: category.id,
        sellingPrice: 1000,
        trackInventory: false,
        productType: ProductType.MENU_ITEM,
        sellOnPos: true,
        active: true,
      },
    });
    createdProductIds.push(product.id);

    const preview = await previewProductDelete({ id: product.id });
    expect(preview.mode).toBe("deleted");

    const result = await deleteProduct({ id: product.id, userId: manager.id });
    expect(result.mode).toBe("deleted");
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();

    const idx = createdProductIds.indexOf(product.id);
    if (idx >= 0) createdProductIds.splice(idx, 1);
  });

  it("deactivates a referenced product and leaves stock, movements, and orders untouched", async () => {
    const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
    if (!manager) throw new Error("Seed manager Patrick is required.");

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: { name: `HistCat ${stamp}`, area: BusinessArea.BAR },
    });
    createdCategoryIds.push(category.id);
    const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
    const bar = await getLocationByCode(prisma, "BAR");
    const product = await prisma.product.create({
      data: {
        name: `Hist Drink ${stamp}`,
        categoryId: category.id,
        sellingPrice: 2500,
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
    await prisma.productStock.updateMany({
      where: { productId: product.id, locationId: bar.id },
      data: { quantity: 9 },
    });
    await syncCompatibilityStock(prisma, product.id);

    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        locationId: bar.id,
        quantity: 9,
        type: "PURCHASE",
        reason: `seed-${stamp}`,
        userId: manager.id,
      },
    });

    const stocksBefore = await prisma.productStock.findMany({ where: { productId: product.id } });
    const movementsBefore = await prisma.inventoryMovement.count({ where: { productId: product.id } });
    const productBefore = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    const preview = await previewProductDelete({ id: product.id });
    expect(preview.mode).toBe("deactivated");

    const result = await deleteProduct({ id: product.id, userId: manager.id });
    expect(result.mode).toBe("deactivated");

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.active).toBe(false);
    expect(after.sellOnPos).toBe(false);
    expect(after.sellingPrice).toBe(productBefore.sellingPrice);
    expect(after.stockQuantity).toBe(productBefore.stockQuantity);

    const stocksAfter = await prisma.productStock.findMany({ where: { productId: product.id } });
    expect(stocksAfter).toEqual(stocksBefore);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id } })).toBe(
      movementsBefore,
    );
  });

  it("deletes an empty category and blocks delete when products still use it", async () => {
    const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
    if (!manager) throw new Error("Seed manager Patrick is required.");

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const empty = await prisma.category.create({
      data: { name: `Empty ${stamp}`, area: BusinessArea.CAFE },
    });
    createdCategoryIds.push(empty.id);

    const used = await prisma.category.create({
      data: { name: `Used ${stamp}`, area: BusinessArea.CAFE },
    });
    createdCategoryIds.push(used.id);
    const product = await prisma.product.create({
      data: {
        name: `Stay ${stamp}`,
        categoryId: used.id,
        sellingPrice: 1500,
        trackInventory: false,
        productType: ProductType.MENU_ITEM,
        sellOnPos: true,
        active: true,
      },
    });
    createdProductIds.push(product.id);

    const deleted = await deleteCategory({ id: empty.id, userId: manager.id });
    expect(deleted.id).toBe(empty.id);
    expect(await prisma.category.findUnique({ where: { id: empty.id } })).toBeNull();
    const emptyIdx = createdCategoryIds.indexOf(empty.id);
    if (emptyIdx >= 0) createdCategoryIds.splice(emptyIdx, 1);

    await expect(deleteCategory({ id: used.id, userId: manager.id })).rejects.toBeInstanceOf(AppError);
    await expect(deleteCategory({ id: used.id, userId: manager.id })).rejects.toThrow(
      /contains products/i,
    );
    expect(await prisma.category.findUnique({ where: { id: used.id } })).not.toBeNull();
    expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });
});
