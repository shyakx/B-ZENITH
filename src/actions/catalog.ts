"use server";

import { ProductUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { catalogProductWriteData, newProductStockQuantity } from "@/lib/catalog-fields";
import { prisma } from "@/lib/prisma";

const roles = ["OWNER", "ADMIN", "INVENTORY"] as const;
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
  trackInventory: z.coerce.boolean().default(false),
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
    trackInventory: formData.has("trackInventory"),
  });

export async function createProduct(formData: FormData) {
  const user = await requireUser(roles);
  const input = productInput(formData);
  const sku = input.sku || `BZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const seedKey = `${input.categoryId}::${input.name}::${sku}`;
  const product = await prisma.product.create({
    data: {
      ...catalogProductWriteData(input),
      sku,
      seedKey,
      stockQuantity: newProductStockQuantity(),
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
  await prisma.product.update({
    where: { id: productId },
    data: catalogProductWriteData({ ...input, sku: input.sku }),
  });
  const defaultVariant = await prisma.productVariant.findFirst({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
  if (defaultVariant) {
    await prisma.productVariant.update({
      where: { id: defaultVariant.id },
      data: { sellingPrice: input.sellingPrice, unit: input.unit },
    });
  }
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
