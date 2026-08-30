export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PAY_LATER";

export type PayableOrder = {
  id: string;
  orderNumber: number;
  total: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
};

export function paymentStatusAfterAmount(
  total: number,
  paidAmount: number,
  markPayLater = false,
): PaymentStatus {
  if (paidAmount < 0) {
    throw new Error("Paid amount cannot be negative.");
  }
  if (paidAmount >= total && total > 0) {
    return "PAID";
  }
  if (paidAmount > 0) {
    return "PARTIALLY_PAID";
  }
  return markPayLater ? "PAY_LATER" : "UNPAID";
}

export const CURRENT_TABLE_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID"] as const;

export function isOrderPayable(status: PaymentStatus): boolean {
  return status === "UNPAID" || status === "PARTIALLY_PAID";
}

export function belongsToCurrentTableBill(order: {
  status?: string;
  paymentStatus: PaymentStatus;
}) {
  return order.status !== "CANCELLED" && isOrderPayable(order.paymentStatus);
}

export function currentTableBillOrders<T extends { status?: string; paymentStatus: PaymentStatus }>(
  orders: T[],
) {
  return orders.filter(belongsToCurrentTableBill);
}

export function validatePaymentAmount(
  total: number,
  paidAmount: number,
  incomingAmount: number,
): { remainingBefore: number; remainingAfter: number } {
  if (!Number.isInteger(incomingAmount) || incomingAmount <= 0) {
    throw new Error("Payment amount must be a positive whole number.");
  }
  const remainingBefore = Math.max(0, total - paidAmount);
  if (remainingBefore <= 0) {
    throw new Error("This bill is already paid.");
  }
  if (incomingAmount > remainingBefore) {
    throw new Error("Payment is larger than the remaining balance.");
  }
  return {
    remainingBefore,
    remainingAfter: remainingBefore - incomingAmount,
  };
}

export function allocateAcrossOrders(
  orders: PayableOrder[],
  amount: number,
): { orderId: string; amount: number }[] {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Payment amount must be a positive whole number.");
  }

  const open = orders
    .filter((order) => isOrderPayable(order.paymentStatus))
    .sort((a, b) => a.orderNumber - b.orderNumber);

  const remainingOnTable = open.reduce(
    (sum, order) => sum + Math.max(0, order.total - order.paidAmount),
    0,
  );

  if (remainingOnTable <= 0) {
    throw new Error("There is nothing left to pay on this table.");
  }
  if (amount > remainingOnTable) {
    throw new Error("Payment is larger than the table balance.");
  }

  let leftover = amount;
  const allocations: { orderId: string; amount: number }[] = [];

  for (const order of open) {
    if (leftover <= 0) break;
    const due = Math.max(0, order.total - order.paidAmount);
    if (due <= 0) continue;
    const apply = Math.min(due, leftover);
    allocations.push({ orderId: order.id, amount: apply });
    leftover -= apply;
  }

  return allocations;
}

export function combinedBill(orders: PayableOrder[]) {
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const paid = orders.reduce((sum, order) => sum + order.paidAmount, 0);
  const remaining = Math.max(0, total - paid);
  const allPaid = orders.length > 0 && orders.every((order) => order.paymentStatus === "PAID");
  const anyPayLater = orders.some((order) => order.paymentStatus === "PAY_LATER" && !allPaid);
  const anyPartial = orders.some((order) => order.paymentStatus === "PARTIALLY_PAID");

  let status: PaymentStatus = "UNPAID";
  if (allPaid) status = "PAID";
  else if (anyPayLater && paid === 0) status = "PAY_LATER";
  else if (paid > 0) status = "PARTIALLY_PAID";
  else if (anyPartial) status = "PARTIALLY_PAID";

  return { total, paid, remaining, status };
}
