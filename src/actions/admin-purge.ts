"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { purgeMaisonRecords, purgeOrders, requirePurgeConfirm } from "@/services/admin-purge";

export async function purgeSalesAction(input: {
  orderIds: string[];
  confirm: string;
}): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission("purgeBusinessData");
    requirePurgeConfirm(input.confirm);
    const result = await purgeOrders(input.orderIds, user.id);
    revalidatePath("/admin/data");
    revalidatePath("/cashier");
    revalidatePath("/waiter");
    revalidatePath("/manager");
    revalidatePath("/owner");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function purgeMaisonAction(input: {
  confirm: string;
}): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission("purgeBusinessData");
    requirePurgeConfirm(input.confirm);
    const result = await purgeMaisonRecords(user.id);
    revalidatePath("/admin/data");
    revalidatePath("/manager/maison");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
