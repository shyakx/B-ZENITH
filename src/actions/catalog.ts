"use server";

import { ProductUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/authorization";
import {
  DELETED_PRODUCT_SKU_PREFIX,
  authorizeProductDelete,
  catalogProductWriteData,
  catalogProductNonPriceWriteData,
  canAdjustPrices,
  isDeletedProductSku,
  newProductStockQuantity,
} from "@/lib/catalog-fields";
import { catalogRoles, userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ensureTrackedProductStock } from "@/lib/location-stock";

const roles = catalogRoles;
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(50).optional(),
  categoryId: z.string().cuid(),
  description: z.string().trim().max(1000).optional(),
  costPrice: z.coerce.number().min(0).max(100_000_000),
  sellingPrice: z.coerce.number().positive().max(100_000_000),
  unit: z.nativeEnum(ProductUnit),
  imageUrl: optionalUrl,
  active: z.coerce.boolean().default(false),
  trackInventory: z.coerce.boolean().default(true),
  sellingLocationCode: z.enum(["BAR", "KITCHEN"]).default("BAR"),
});

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const productInput = (formData: FormData) =>
  productSchema.parse({
    name: text(formData, "name"),
    sku: text(formData, "sku") || undefined,
    categoryId: text(formData, "categoryId"),
    description: text(formData, "description") || undefined,
    costPrice: text(formData, "costPrice"),
    sellingPrice: text(formData, "sellingPrice"),
    unit: text(formData, "unit"),
    imageUrl: text(formData, "imageUrl"),
    active: formData.has("active"),
    trackInventory: true,
    sellingLocationCode: text(formData, "sellingLocationCode") || "BAR",
  });

export async function createProduct(formData: FormData) {
  const user = await requireUser(roles);
  const input = productInput(formData);
  const sku = input.sku || `BZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const seedKey = `${input.categoryId}::${input.name}::${sku}`;
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        ...catalogProductWriteData(input),
        sku,
        seedKey,
        variants: {
          create: {
            name: "Portion",
            sku: `${sku}-PORTION`,
            sellingPrice: input.sellingPrice,
            unit: input.unit,
            sortOrder: 0,
          },
        },
      },
    });
    await ensureTrackedProductStock(tx, created.id, true, input.sellingLocationCode);
    return created;
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE_PRODUCT", entity: "Product", entityId: product.id },
  });
  revalidatePath("/menu");
  revalidatePath("/pos");
  redirect(`/menu/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const user = await requireUser(roles);
  const input = productInput(formData);
  const includePrices = canAdjustPrices(user.role);
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: includePrices
        ? catalogProductWriteData({ ...input, sku: input.sku })
        : catalogProductNonPriceWriteData({ ...input, sku: input.sku }),
    });
    await ensureTrackedProductStock(tx, productId, true, input.sellingLocationCode);
    const defaultVariant = await tx.productVariant.findFirst({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    if (defaultVariant) {
      await tx.productVariant.update({
        where: { id: defaultVariant.id },
        data: includePrices ? { sellingPrice: input.sellingPrice, unit: input.unit } : { unit: input.unit },
      });
    }
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE_MENU_ITEM", entity: "Product", entityId: productId },
  });
  revalidatePath("/menu");
  revalidatePath(`/menu/${productId}`);
  revalidatePath("/pos");
}

export async function toggleProduct(productId: string, active: boolean) {
  const user = await requireUser(roles);
  await prisma.product.update({ where: { id: productId }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE_MENU_ITEM",
      entity: "Product",
      entityId: productId,
      details: { active },
    },
  });
  revalidatePath("/menu");
  revalidatePath("/pos");
}

export async function deleteProduct(productId: string) {
  const user = await requireUser(userAdminRoles);
  const allowed = authorizeProductDelete(user.role);
  if (!allowed.ok) return { error: allowed.error };

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      _count: {
        select: { saleItems: true, purchaseItems: true, returnItems: true, movements: true },
      },
    },
  });
  if (isDeletedProductSku(product.sku)) {
    return { error: "This menu item is already removed." };
  }

  const hasHistory = Object.values(product._count).some((count) => count > 0);
  await writeAudit(user, {
    action: "DELETE_PRODUCT",
    entity: "Product",
    entityId: productId,
    details: { name: product.name, sku: product.sku, keptHistory: hasHistory },
  });

  if (hasHistory) {
    const tombstone = `${DELETED_PRODUCT_SKU_PREFIX}${productId}`;
    await prisma.product.update({
      where: { id: productId },
      data: {
        active: false,
        name: tombstone,
        sku: tombstone,
        seedKey: tombstone,
      },
    });
    await prisma.productVariant.updateMany({
      where: { productId },
      data: { active: false },
    });
  } else {
    await prisma.product.delete({ where: { id: productId } });
  }

  revalidatePath("/menu");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  return {};
}

export async function createCategory(formData: FormData) {
  const user = await requireUser(roles);
  const name = z.string().trim().min(2).max(80).parse(text(formData, "name"));
  const category = await prisma.category.create({ data: { name } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE_CATEGORY", entity: "Category", entityId: category.id },
  });
  revalidatePath("/categories");
  revalidatePath("/menu");
}

export async function updateCategory(categoryId: string, formData: FormData) {
  const user = await requireUser(roles);
  const name = z.string().trim().min(2).max(80).parse(text(formData, "name"));
  await prisma.category.update({
    where: { id: categoryId },
    data: { name, active: formData.has("active") },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE_CATEGORY", entity: "Category", entityId: categoryId },
  });
  revalidatePath("/categories");
  revalidatePath("/menu");
  revalidatePath("/pos");
}
