import { BusinessArea, OrderStatus, PaymentStatus, ProductType } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { KITCHEN_BASE_MATERIALS, KITCHEN_STORES_CATEGORY } from "@/lib/domain/kitchen-stores";
import { findSimilarCatalogNames } from "@/lib/domain/name-similarity";
import { AppError, SimilarNameError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ensureTrackedProductStocks, sellOnPosForType, syncCompatibilityStock } from "@/services/stock";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function listActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listPosCatalog() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true, sellOnPos: true },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const used = new Set(products.map((product) => product.category.id));
  return { categories: categories.filter((category) => used.has(category.id)), products };
}

export async function listManagedTables() {
  const [tables, busy] = await Promise.all([
    listTables(),
    prisma.order.groupBy({
      by: ["tableId"],
      where: {
        status: { not: OrderStatus.CANCELLED },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
      },
      _count: { _all: true },
    }),
  ]);
  const inUse = new Set(busy.map((row) => row.tableId));
  return tables.map((table) => ({ ...table, inUse: inUse.has(table.id) }));
}

export async function listAllProducts() {
  return prisma.product.findMany({
    include: {
      category: true,
      stocks: { include: { location: { select: { code: true, name: true, sortOrder: true } } } },
      defaultStockLocation: { select: { id: true, code: true, name: true } },
      baseUnit: { select: { id: true, code: true, name: true } },
      packs: {
        where: { active: true },
        select: {
          unitId: true,
          baseQuantity: true,
          unit: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

async function defaultUnitId(productType: ProductType) {
  const code = productType === ProductType.PACKAGED_GOOD ? "BOTTLE" : productType === ProductType.RAW_MATERIAL ? "KG" : "PIECE";
  const unit = await prisma.unit.findUnique({ where: { code } });
  return unit?.id ?? null;
}

async function defaultLocationId(productType: ProductType, trackInventory: boolean) {
  if (!trackInventory) return null;
  const code =
    productType === ProductType.RAW_MATERIAL ? LOCATION_CODES.KITCHEN : LOCATION_CODES.BAR;
  const location = await prisma.stockLocation.findUnique({ where: { code } });
  return location?.id ?? null;
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  categoryId: string;
  sellingPrice: number;
  costPrice?: number | null;
  trackInventory: boolean;
  active: boolean;
  productType?: ProductType;
  sellOnPos?: boolean;
  baseUnitId?: string | null;
  defaultStockLocationId?: string | null;
  purchaseUnitId?: string | null;
  purchaseContains?: number | null;
  wholePackageTransfer?: boolean;
  /** Manager confirmed create/rename despite a similar existing name. */
  confirmSimilarName?: boolean;
  userId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Product name is required.");
  if (!input.categoryId) throw new AppError("Choose a category (Breakfast, Drinks, etc.).");
  if (!Number.isInteger(input.sellingPrice) || input.sellingPrice < 0) {
    throw new AppError("Selling price must be a whole number.");
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError("Category not found.");

  const productType = input.productType ?? ProductType.MENU_ITEM;
  const trackInventory = productType === ProductType.RAW_MATERIAL ? true : input.trackInventory;
  const sellOnPos = productType === ProductType.RAW_MATERIAL ? false : (input.sellOnPos ?? sellOnPosForType(productType));
  const baseUnitId = input.baseUnitId ?? (await defaultUnitId(productType));
  const defaultStockLocationId =
    input.defaultStockLocationId ?? (await defaultLocationId(productType, trackInventory));
  const wholePackageTransfer = Boolean(input.wholePackageTransfer);

  if (trackInventory && defaultStockLocationId) {
    const location = await prisma.stockLocation.findUnique({ where: { id: defaultStockLocationId } });
    if (!location || location.code === LOCATION_CODES.MAIN) {
      throw new AppError("Choose Bar, Kitchen, or Cafe for where this is sold or used.");
    }
  }

  if (wholePackageTransfer) {
    if (!input.purchaseUnitId || !baseUnitId || input.purchaseUnitId === baseUnitId) {
      throw new AppError(
        "Whole package transfer needs a Package different from the Stock unit (for example CRATE of BOTTLES).",
      );
    }
    if (!Number.isInteger(input.purchaseContains) || !input.purchaseContains || input.purchaseContains <= 1) {
      throw new AppError("Units per package must be greater than 1 for whole-package transfer.");
    }
  }

  if (input.id) {
    const current = await prisma.product.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError("Product not found.");

    if (!input.confirmSimilarName && current.name.trim().toLowerCase() !== name.toLowerCase()) {
      await assertNoSimilarProductName(name, input.id);
    }

    const updated = await prisma.product.update({
      where: { id: input.id },
      data: {
        name,
        categoryId: input.categoryId,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice == null ? null : input.costPrice,
        trackInventory,
        active: input.active,
        productType,
        sellOnPos,
        baseUnitId,
        defaultStockLocationId,
        wholePackageTransfer,
      },
    });

    if (trackInventory) {
      await ensureTrackedProductStocks(prisma, updated.id);
      await syncCompatibilityStock(prisma, updated.id);
    }
    await saveHowYouBuy(updated.id, baseUnitId, input.purchaseUnitId, input.purchaseContains);

    if (current.sellingPrice !== updated.sellingPrice) {
      await writeAudit({
        userId: input.userId,
        action: "PRODUCT_PRICE_CHANGED",
        entity: "Product",
        entityId: updated.id,
        before: { sellingPrice: current.sellingPrice },
        after: { sellingPrice: updated.sellingPrice, name },
      });
    }

    return updated;
  }

  if (!input.confirmSimilarName) {
    await assertNoSimilarProductName(name);
  }

  const created = await prisma.product.create({
    data: {
      name,
      categoryId: input.categoryId,
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice == null ? null : input.costPrice,
      trackInventory,
      active: input.active,
      productType,
      sellOnPos,
      baseUnitId,
      defaultStockLocationId,
      wholePackageTransfer,
    },
  });
  if (trackInventory) {
    await ensureTrackedProductStocks(prisma, created.id, 0);
  }
  await saveHowYouBuy(created.id, baseUnitId, input.purchaseUnitId, input.purchaseContains);
  return created;
}

async function assertNoSimilarProductName(name: string, excludeId?: string) {
  const candidates = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const similar = findSimilarCatalogNames(name, candidates, { excludeId, limit: 3 });
  if (similar.length > 0) {
    throw new SimilarNameError(
      "Similar product already exists",
      similar.map((row) => ({ id: row.id, name: row.name, kind: row.kind })),
    );
  }
}

export async function previewProductDelete(input: { id: string }) {
  const product = await prisma.product.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          orderItems: true,
          purchases: true,
          movements: true,
          receiptLines: true,
          transferLines: true,
        },
      },
    },
  });
  if (!product) throw new AppError("Product not found.");

  const historyCount =
    product._count.orderItems +
    product._count.purchases +
    product._count.movements +
    product._count.receiptLines +
    product._count.transferLines;

  if (historyCount > 0) {
    return {
      id: product.id,
      name: product.name,
      mode: "deactivated" as const,
      message:
        "This product has historical records and cannot be permanently deleted. It can be removed from active use instead.",
    };
  }

  return {
    id: product.id,
    name: product.name,
    mode: "deleted" as const,
    message: "Delete this product? It has no order or stock history, so it can be removed completely.",
  };
}

export async function deleteProduct(input: { id: string; userId: string }) {
  const product = await prisma.product.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      active: true,
      _count: {
        select: {
          orderItems: true,
          purchases: true,
          movements: true,
          receiptLines: true,
          transferLines: true,
        },
      },
    },
  });
  if (!product) throw new AppError("Product not found.");

  const historyCount =
    product._count.orderItems +
    product._count.purchases +
    product._count.movements +
    product._count.receiptLines +
    product._count.transferLines;

  if (historyCount > 0) {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { active: false, sellOnPos: false },
    });
    await writeAudit({
      userId: input.userId,
      action: "PRODUCT_REMOVED",
      entity: "Product",
      entityId: product.id,
      before: { name: product.name, active: product.active },
      after: { name: updated.name, active: false, mode: "deactivated" },
    });
    return {
      id: product.id,
      mode: "deactivated" as const,
      message:
        "Removed from active use. Orders, payments, and stock history were kept unchanged.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.productStock.deleteMany({ where: { productId: product.id } });
    await tx.productPack.deleteMany({ where: { productId: product.id } });
    await tx.product.delete({ where: { id: product.id } });
  });

  await writeAudit({
    userId: input.userId,
    action: "PRODUCT_DELETED",
    entity: "Product",
    entityId: product.id,
    before: { name: product.name },
    after: { mode: "deleted" },
  });

  return {
    id: product.id,
    mode: "deleted" as const,
    message: "Product deleted.",
  };
}

export async function kitchenStoresStatus() {
  const existing = await prisma.product.findMany({
    where: { productType: ProductType.RAW_MATERIAL, name: { in: KITCHEN_BASE_MATERIALS.map((row) => row.name) } },
    select: { name: true },
  });
  const have = new Set(existing.map((row) => row.name));
  const missing = KITCHEN_BASE_MATERIALS.filter((row) => !have.has(row.name)).map((row) => row.name);
  return { missing, total: KITCHEN_BASE_MATERIALS.length, present: KITCHEN_BASE_MATERIALS.length - missing.length };
}

export async function ensureKitchenStoreCatalog(_userId: string) {
  const names = KITCHEN_BASE_MATERIALS.map((row) => row.name);
  const [units, locations, existing] = await Promise.all([
    prisma.unit.findMany(),
    prisma.stockLocation.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { productType: ProductType.RAW_MATERIAL, name: { in: names } },
      select: { id: true, name: true, stocks: { select: { locationId: true } } },
    }),
  ]);
  const unitIds = Object.fromEntries(units.map((unit) => [unit.code, unit.id]));
  const kitchen = locations.find((location) => location.code === LOCATION_CODES.KITCHEN);
  if (!kitchen) throw new AppError("Kitchen stock location is not configured.");

  const have = new Set(existing.map((row) => row.name));
  const missing = KITCHEN_BASE_MATERIALS.filter((row) => !have.has(row.name));

  const category = await prisma.category.upsert({
    where: { name: KITCHEN_STORES_CATEGORY },
    create: { name: KITCHEN_STORES_CATEGORY, area: BusinessArea.OTHER, sortOrder: 10_000 },
    update: { area: BusinessArea.OTHER },
  });

  const created =
    missing.length === 0
      ? []
      : await prisma.product.createManyAndReturn({
          data: missing.map((material, index) => ({
            name: material.name,
            categoryId: category.id,
            sellingPrice: 0,
            trackInventory: true,
            active: true,
            productType: ProductType.RAW_MATERIAL,
            sellOnPos: false,
            baseUnitId: unitIds[material.baseUnitCode] ?? unitIds.KG ?? unitIds.PIECE ?? null,
            defaultStockLocationId: kitchen.id,
            sortOrder: index,
            stockQuantity: 0,
          })),
        });

  const stockRows: { productId: string; locationId: string; quantity: number }[] = [];
  for (const product of existing) {
    const haveLocation = new Set(product.stocks.map((row) => row.locationId));
    for (const location of locations) {
      if (!haveLocation.has(location.id)) {
        stockRows.push({ productId: product.id, locationId: location.id, quantity: 0 });
      }
    }
  }
  for (const product of created) {
    for (const location of locations) {
      stockRows.push({ productId: product.id, locationId: location.id, quantity: 0 });
    }
  }
  if (stockRows.length > 0) {
    await prisma.productStock.createMany({ data: stockRows, skipDuplicates: true });
  }

  return { created: created.length, total: KITCHEN_BASE_MATERIALS.length };
}

async function saveHowYouBuy(
  productId: string,
  baseUnitId: string | null,
  purchaseUnitId?: string | null,
  purchaseContains?: number | null,
) {
  if (!purchaseUnitId || !baseUnitId || purchaseUnitId === baseUnitId) {
    // Same as stock unit, or cleared: no package conversion. Does not touch ProductStock.
    await prisma.productPack.updateMany({
      where: { productId, active: true },
      data: { active: false },
    });
    return;
  }
  if (!Number.isInteger(purchaseContains) || !purchaseContains || purchaseContains <= 0) {
    throw new AppError("Enter how many stock units are in one package.");
  }
  await prisma.productPack.updateMany({
    where: { productId, active: true, NOT: { unitId: purchaseUnitId } },
    data: { active: false },
  });
  await prisma.productPack.upsert({
    where: { productId_unitId: { productId, unitId: purchaseUnitId } },
    update: { baseQuantity: purchaseContains, active: true },
    create: {
      productId,
      unitId: purchaseUnitId,
      baseQuantity: purchaseContains,
      active: true,
    },
  });
}

/**
 * Packaging rules only. Never changes ProductStock, movements, prices, or historical data.
 */
export async function listTrackedProductPackaging() {
  return prisma.product.findMany({
    where: { trackInventory: true, active: true },
    select: {
      id: true,
      name: true,
      wholePackageTransfer: true,
      category: { select: { name: true, area: true } },
      baseUnit: { select: { id: true, code: true, name: true } },
      packs: {
        where: { active: true },
        select: {
          unitId: true,
          baseQuantity: true,
          unit: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export async function updateProductPackaging(input: {
  productId: string;
  packageUnitId: string | null;
  unitsPerPackage: number | null;
  wholePackageTransfer: boolean;
  userId: string;
}) {
  await requirePermissionForPackaging(input.userId);

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      trackInventory: true,
      active: true,
      baseUnitId: true,
      baseUnit: { select: { id: true, code: true, name: true } },
    },
  });
  if (!product || !product.active || !product.trackInventory) {
    throw new AppError("Choose a tracked product.");
  }
  if (!product.baseUnitId) {
    throw new AppError("This product has no stock unit yet. Set the stock unit on Products first.");
  }

  const packageUnitId = input.packageUnitId?.trim() || null;
  const sameAsStock = !packageUnitId || packageUnitId === product.baseUnitId;
  let wholePackageTransfer = Boolean(input.wholePackageTransfer);

  if (sameAsStock) {
    wholePackageTransfer = false;
    await saveHowYouBuy(product.id, product.baseUnitId, product.baseUnitId, 1);
  } else {
    if (!Number.isInteger(input.unitsPerPackage) || !input.unitsPerPackage || input.unitsPerPackage <= 0) {
      throw new AppError("Enter units per package (a whole number greater than 0).");
    }
    if (wholePackageTransfer && input.unitsPerPackage <= 1) {
      throw new AppError("Whole package only needs more than 1 stock unit per package.");
    }
    const unit = await prisma.unit.findUnique({ where: { id: packageUnitId } });
    if (!unit || !unit.active) throw new AppError("Choose a valid package type.");
    await saveHowYouBuy(product.id, product.baseUnitId, packageUnitId, input.unitsPerPackage);
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { wholePackageTransfer },
    select: {
      id: true,
      name: true,
      wholePackageTransfer: true,
      packs: {
        where: { active: true },
        select: {
          unitId: true,
          baseQuantity: true,
          unit: { select: { code: true, name: true } },
        },
      },
    },
  });

  await writeAudit({
    userId: input.userId,
    action: "PRODUCT_PACKAGING_CHANGED",
    entity: "Product",
    entityId: product.id,
    after: {
      name: product.name,
      packageUnitId: sameAsStock ? null : packageUnitId,
      unitsPerPackage: sameAsStock ? null : input.unitsPerPackage,
      wholePackageTransfer: updated.wholePackageTransfer,
      note: "Packaging rule only — stock quantities unchanged",
    },
  });

  return updated;
}

async function requirePermissionForPackaging(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true },
  });
  if (!user || !user.active) throw new AppError("Not allowed.");
  const role = user.role as Role;
  if (!hasPermission(role, "manageProducts") && !hasPermission(role, "manageInventory")) {
    throw new AppError("You are not allowed to change packaging.", "FORBIDDEN");
  }
}

export async function upsertCategory(input: {
  id?: string;
  name: string;
  area: BusinessArea;
  /** Manager confirmed create/rename despite a similar existing name. */
  confirmSimilarName?: boolean;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Category name is required.");

  if (input.id) {
    const current = await prisma.category.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError("Category not found.");

    if (!input.confirmSimilarName && current.name.trim().toLowerCase() !== name.toLowerCase()) {
      await assertNoSimilarCategoryName(name, input.id);
    }

    return prisma.category.update({
      where: { id: input.id },
      data: { name, area: input.area },
    });
  }

  if (!input.confirmSimilarName) {
    await assertNoSimilarCategoryName(name);
  }

  const last = await prisma.category.findFirst({ orderBy: { sortOrder: "desc" } });
  try {
    return await prisma.category.create({
      data: { name, area: input.area, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new AppError("A category with this name already exists.");
    }
    throw error;
  }
}

async function assertNoSimilarCategoryName(name: string, excludeId?: string) {
  const candidates = await prisma.category.findMany({ select: { id: true, name: true } });
  const similar = findSimilarCatalogNames(name, candidates, { excludeId, limit: 3 });
  if (similar.length > 0) {
    throw new SimilarNameError(
      "Similar category already exists",
      similar.map((row) => ({ id: row.id, name: row.name, kind: row.kind })),
    );
  }
}

export async function deleteCategory(input: { id: string; userId: string }) {
  const category = await prisma.category.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
  });
  if (!category) throw new AppError("Category not found.");

  if (category.name === KITCHEN_STORES_CATEGORY) {
    throw new AppError("Kitchen Stores is required for stock items and cannot be deleted.");
  }

  if (category._count.products > 0) {
    throw new AppError("This category contains products and cannot be deleted yet.");
  }

  await prisma.category.delete({ where: { id: category.id } });
  await writeAudit({
    userId: input.userId,
    action: "CATEGORY_DELETED",
    entity: "Category",
    entityId: category.id,
    before: { name: category.name },
    after: { mode: "deleted" },
  });

  return {
    id: category.id,
    message: "Category deleted.",
  };
}

export async function listTables(activeOnly = false) {
  return prisma.serviceTable.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertTable(input: { id?: string; name: string; active: boolean }) {
  const name = input.name.trim();
  if (!name) throw new AppError("Table name is required.");

  if (input.id) {
    return prisma.serviceTable.update({
      where: { id: input.id },
      data: { name, active: input.active },
    });
  }

  const last = await prisma.serviceTable.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.serviceTable.create({
    data: { name, active: input.active, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
}

/** Manager nickname labels only — never touches stock, units, or prices. */
export async function listProductNameReferences() {
  return prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      trackInventory: true,
      stockQuantity: true,
      managerReferenceName: true,
      managerReferenceNote: true,
      category: { select: { name: true } },
      baseUnit: { select: { code: true, name: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export async function updateManagerProductReference(input: {
  productId: string;
  managerReferenceName: string | null;
  managerReferenceNote: string | null;
  userId: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      managerReferenceName: true,
      managerReferenceNote: true,
      stockQuantity: true,
      baseUnitId: true,
      sellingPrice: true,
    },
  });
  if (!product) throw new AppError("Product not found.");

  const managerReferenceName = input.managerReferenceName?.trim() || null;
  const managerReferenceNote = input.managerReferenceNote?.trim() || null;
  if (managerReferenceName && managerReferenceName.length > 80) {
    throw new AppError("Manager reference name must be 80 characters or less.");
  }
  if (managerReferenceNote && managerReferenceNote.length > 160) {
    throw new AppError("Manager note must be 160 characters or less.");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { managerReferenceName, managerReferenceNote },
    select: {
      id: true,
      name: true,
      managerReferenceName: true,
      managerReferenceNote: true,
      stockQuantity: true,
      baseUnitId: true,
      sellingPrice: true,
    },
  });

  await writeAudit({
    userId: input.userId,
    action: "PRODUCT_MANAGER_REFERENCE_UPDATED",
    entity: "Product",
    entityId: product.id,
    before: {
      managerReferenceName: product.managerReferenceName,
      managerReferenceNote: product.managerReferenceNote,
      stockQuantity: product.stockQuantity,
      baseUnitId: product.baseUnitId,
      sellingPrice: product.sellingPrice,
    },
    after: {
      managerReferenceName: updated.managerReferenceName,
      managerReferenceNote: updated.managerReferenceNote,
      stockQuantity: updated.stockQuantity,
      baseUnitId: updated.baseUnitId,
      sellingPrice: updated.sellingPrice,
    },
  });

  return updated;
}
