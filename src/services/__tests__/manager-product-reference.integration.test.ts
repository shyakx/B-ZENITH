import { loadEnvConfig } from "@next/env";
import { BusinessArea, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { updateManagerProductReference } from "@/services/products";
import { listInventoryMovementReport } from "@/services/inventory";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";
import { cleanupInventoryArtifacts } from "./inventory-helpers";

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

describe("manager product reference", () => {
  it("lets inventory managers edit nicknames without changing stock math fields", async () => {
    expect(hasPermission("MANAGER", "manageInventory")).toBe(true);
    expect(hasPermission("WAITER", "manageInventory")).toBe(false);
    expect(hasPermission("CASHIER", "manageInventory")).toBe(false);

    const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
    if (!manager) throw new Error("Seed manager Patrick is required.");

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: { name: `Ref ${stamp}`, area: BusinessArea.BAR },
    });
    createdCategoryIds.push(category.id);
    const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
    const bar = await getLocationByCode(prisma, "BAR");
    const product = await prisma.product.create({
      data: {
        name: `Heineken Ref ${stamp}`,
        categoryId: category.id,
        sellingPrice: 2000,
        costPrice: 900,
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
      where: { productId: product.id, location: { code: "BAR" } },
      data: { quantity: 17 },
    });
    await syncCompatibilityStock(prisma, product.id);

    const before = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    const updated = await updateManagerProductReference({
      productId: product.id,
      managerReferenceName: "Heineken can",
      managerReferenceNote: "500ml",
      userId: manager.id,
    });

    expect(updated.managerReferenceName).toBe("Heineken can");
    expect(updated.managerReferenceNote).toBe("500ml");
    expect(updated.stockQuantity).toBe(before.stockQuantity);
    expect(updated.baseUnitId).toBe(before.baseUnitId);
    expect(updated.sellingPrice).toBe(before.sellingPrice);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(17);
    expect(after.baseUnitId).toBe(bottle?.id);
    expect(after.sellingPrice).toBe(2000);

    const report = await listInventoryMovementReport();
    const row = report.find((item) => item.id === product.id);
    expect(row).toBeTruthy();
    expect(row!.onHand).toBe(17);
    expect(row!.unitCode).toBe("BOTTLE");
    expect(row!.received + row!.sold + row!.returned + row!.wasted).toBe(0);
  });
});
