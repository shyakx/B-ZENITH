"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { adjustStock, countStock, receivePurchase, recordWaste } from "@/services/inventory";

function refresh() {
  revalidatePath("/manager/inventory");
  revalidatePath("/manager/purchases");
  revalidatePath("/manager");
}

export async function receivePurchaseAction(input: {
  productId: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const purchase = await receivePurchase({ ...input, userId: user.id });
    refresh();
    return ok({ id: purchase.id });
  } catch (error) {
    return fail(error);
  }
}

export async function recordWasteAction(input: {
  productId: string;
  quantity: number;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await recordWaste({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}

export async function adjustStockAction(input: {
  productId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await adjustStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}

export async function countStockAction(input: {
  productId: string;
  counted: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await countStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}
