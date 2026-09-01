import { BusinessArea, OrderStatus, PaymentStatus, ProductType } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { AppError } from "@/lib/errors";
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
  const code = productType === ProductType.PACKAGED_GOOD ? "BOTTLE" : "PIECE";
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
  userId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Product name is required.");
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

  if (trackInventory && defaultStockLocationId) {
    const location = await prisma.stockLocation.findUnique({ where: { id: defaultStockLocationId } });
    if (!location || location.code === LOCATION_CODES.MAIN) {
      throw new AppError("Choose Bar, Kitchen, or Cafe for where this is sold or used.");
    }
  }

  if (input.id) {
    const current = await prisma.product.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError("Product not found.");

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
    },
  });
  if (trackInventory) {
    await ensureTrackedProductStocks(prisma, created.id, 0);
  }
  await saveHowYouBuy(created.id, baseUnitId, input.purchaseUnitId, input.purchaseContains);
  return created;
}

async function saveHowYouBuy(
  productId: string,
  baseUnitId: string | null,
  purchaseUnitId?: string | null,
  purchaseContains?: number | null,
) {
  if (!purchaseUnitId || !baseUnitId || purchaseUnitId === baseUnitId) return;
  if (!Number.isInteger(purchaseContains) || !purchaseContains || purchaseContains <= 0) {
    throw new AppError("Say how many stock units are in one purchase unit.");
  }
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

export async function upsertCategory(input: {
  id?: string;
  name: string;
  area: BusinessArea;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Category name is required.");

  if (input.id) {
    return prisma.category.update({
      where: { id: input.id },
      data: { name, area: input.area },
    });
  }

  const last = await prisma.category.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.category.create({
    data: { name, area: input.area, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
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
