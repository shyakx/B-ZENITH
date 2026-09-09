import { loadEnvConfig } from "@next/env";
import { BusinessArea, ProductType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateProductPackaging } from "@/services/products";

loadEnvConfig(process.cwd());

describe("product packaging setup", () => {
  it("saves package rules without changing on-hand stock or inventing sizes", async () => {
    const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
    if (!manager) throw new Error("Seed manager Patrick is required.");

    const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
    const carton = await prisma.unit.findUnique({ where: { code: "CARTON" } });
    const main = await prisma.stockLocation.findUnique({ where: { code: "MAIN" } });
    const bar = await prisma.stockLocation.findUnique({ where: { code: "BAR" } });
    if (!bottle || !carton || !main || !bar) throw new Error("units/locations missing");

    const category = await prisma.category.create({
      data: {
        name: `Packaging Cat ${Date.now()}`,
        area: BusinessArea.BAR,
        sortOrder: 950,
      },
    });
    const product = await prisma.product.create({
      data: {
        name: `Packaging Water ${Date.now()}`,
        categoryId: category.id,
        sellingPrice: 1000,
        trackInventory: true,
        productType: ProductType.PACKAGED_GOOD,
        sellOnPos: true,
        baseUnitId: bottle.id,
        defaultStockLocationId: bar.id,
        active: true,
      },
    });
    await prisma.productStock.createMany({
      data: [
        { productId: product.id, locationId: main.id, quantity: 40 },
        { productId: product.id, locationId: bar.id, quantity: 10 },
      ],
    });

    const before = await prisma.productStock.findMany({
      where: { productId: product.id },
      orderBy: { locationId: "asc" },
    });

    await updateProductPackaging({
      productId: product.id,
      packageUnitId: carton.id,
      unitsPerPackage: 6,
      wholePackageTransfer: true,
      userId: manager.id,
    });

    const after = await prisma.productStock.findMany({
      where: { productId: product.id },
      orderBy: { locationId: "asc" },
    });
    expect(after.map((row) => ({ locationId: row.locationId, quantity: row.quantity }))).toEqual(
      before.map((row) => ({ locationId: row.locationId, quantity: row.quantity })),
    );

    const pack = await prisma.productPack.findFirst({
      where: { productId: product.id, active: true },
      include: { unit: true },
    });
    expect(pack?.unit.code).toBe("CARTON");
    expect(pack?.baseQuantity).toBe(6);

    const movements = await prisma.inventoryMovement.count({ where: { productId: product.id } });
    expect(movements).toBe(0);

    await updateProductPackaging({
      productId: product.id,
      packageUnitId: null,
      unitsPerPackage: null,
      wholePackageTransfer: false,
      userId: manager.id,
    });
    expect(await prisma.productPack.count({ where: { productId: product.id, active: true } })).toBe(0);
    expect(
      (await prisma.productStock.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: main.id } },
      }))?.quantity,
    ).toBe(40);
  });
});
