"use server";

import { BusinessArea } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { upsertCategory, upsertProduct, upsertTable } from "@/services/products";

export async function saveProductAction(input: {
  id?: string;
  name: string;
  categoryId: string;
  sellingPrice: number;
  costPrice?: number | null;
  trackInventory: boolean;
  active: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageProducts");
    const product = await upsertProduct({ ...input, userId: user.id });
    revalidatePath("/manager/products");
    return ok({ id: product.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveCategoryAction(input: {
  id?: string;
  name: string;
  area: BusinessArea;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageProducts");
    const category = await upsertCategory(input);
    revalidatePath("/manager/products");
    return ok({ id: category.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveTableAction(input: {
  id?: string;
  name: string;
  active: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageProducts");
    const table = await upsertTable(input);
    revalidatePath("/manager/products");
    return ok({ id: table.id });
  } catch (error) {
    return fail(error);
  }
}
