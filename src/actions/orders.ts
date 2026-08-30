"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireRole } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { cancelOrder, createOrder, type OrderWithDetails } from "@/services/orders";

export async function createOrderAction(input: {
  tableId: string;
  items: { productId: string; quantity: number }[];
  note?: string;
  idempotencyKey: string;
}): Promise<ActionResult<{ orderNumber: number; id: string }>> {
  try {
    const user = await requirePermission("createOrder");
    const order = await createOrder({
      waiterId: user.id,
      tableId: input.tableId,
      items: input.items,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    });
    revalidatePath("/waiter");
    revalidatePath("/waiter/orders");
    revalidatePath("/cashier");
    return ok({ orderNumber: order.orderNumber, id: order.id });
  } catch (error) {
    return fail(error);
  }
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult<OrderWithDetails>> {
  try {
    const user = await requirePermission("cancelOrder");
    const order = await cancelOrder({ orderId, userId: user.id });
    revalidatePath("/cashier");
    revalidatePath("/manager/orders");
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}

export async function voidOwnOrderAction(orderId: string): Promise<ActionResult<OrderWithDetails>> {
  try {
    const user = await requireRole("WAITER");
    const order = await cancelOrder({
      orderId,
      userId: user.id,
      ownerWaiterId: user.id,
    });
    revalidatePath("/waiter");
    revalidatePath("/waiter/orders");
    revalidatePath("/cashier");
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}
