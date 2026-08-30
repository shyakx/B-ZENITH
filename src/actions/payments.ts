"use server";

import { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { markPayLater, recordPayment, recordTablePayment, settleCredit } from "@/services/payments";

function refreshPaymentPaths() {
  revalidatePath("/cashier");
  revalidatePath("/cashier/bills");
  revalidatePath("/cashier/payments");
  revalidatePath("/cashier/outstanding");
  revalidatePath("/manager");
}

export async function recordPaymentAction(input: {
  orderId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<ActionResult<{ paymentStatus: string; paidAmount: number; remaining: number; amount: number }>> {
  try {
    const user = await requirePermission("recordPayment");
    const order = await recordPayment({
      orderId: input.orderId,
      amount: input.amount,
      method: PaymentMethod.CASH,
      cashierId: user.id,
      idempotencyKey: input.idempotencyKey,
    });
    refreshPaymentPaths();
    return ok({
      paymentStatus: order.paymentStatus,
      paidAmount: order.paidAmount,
      remaining: Math.max(0, order.total - order.paidAmount),
      amount: input.amount,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function recordTablePaymentAction(input: {
  tableId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<
  ActionResult<{
    amount: number;
    remaining: number;
    allocations: {
      orderId: string;
      orderNumber: number;
      amount: number;
      paidAmount: number;
      remaining: number;
      paymentStatus: string;
    }[];
  }>
> {
  try {
    const user = await requirePermission("recordPayment");
    const result = await recordTablePayment({
      tableId: input.tableId,
      amount: input.amount,
      method: PaymentMethod.CASH,
      cashierId: user.id,
      idempotencyKey: input.idempotencyKey,
    });
    refreshPaymentPaths();
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function markPayLaterAction(input: {
  orderId: string;
  customerName: string;
  customerPhone?: string;
}): Promise<ActionResult<{ paymentStatus: string }>> {
  try {
    const user = await requirePermission("payLater");
    const order = await markPayLater({
      ...input,
      cashierId: user.id,
    });
    refreshPaymentPaths();
    return ok({ paymentStatus: order.paymentStatus });
  } catch (error) {
    return fail(error);
  }
}

export async function settleCreditAction(input: {
  creditId: string;
  idempotencyKey: string;
}): Promise<ActionResult<{ paymentStatus: string }>> {
  try {
    const user = await requirePermission("recordPayment");
    const order = await settleCredit({
      creditId: input.creditId,
      method: PaymentMethod.CASH,
      cashierId: user.id,
      idempotencyKey: input.idempotencyKey,
    });
    refreshPaymentPaths();
    return ok({ paymentStatus: order.paymentStatus });
  } catch (error) {
    return fail(error);
  }
}
