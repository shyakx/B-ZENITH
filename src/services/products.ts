import { BusinessArea } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

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

export async function listAllProducts() {
  return prisma.product.findMany({
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  categoryId: string;
  sellingPrice: number;
  costPrice?: number | null;
  trackInventory: boolean;
  active: boolean;
  userId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Product name is required.");
  if (!Number.isInteger(input.sellingPrice) || input.sellingPrice < 0) {
    throw new AppError("Selling price must be a whole number.");
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError("Category not found.");

  if (input.id) {
    const current = await prisma.product.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError("Product not found.");

    const updated = await prisma.product.update({
      where: { id: input.id },
      data: {
        name,
        categoryId: input.categoryId,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice ?? null,
        trackInventory: input.trackInventory,
        active: input.active,
      },
    });

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

  return prisma.product.create({
    data: {
      name,
      categoryId: input.categoryId,
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice ?? null,
      trackInventory: input.trackInventory,
      active: input.active,
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
