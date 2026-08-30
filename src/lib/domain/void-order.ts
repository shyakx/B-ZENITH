import { OrderStatus, PaymentStatus } from "@prisma/client";

export function canWaiterVoidOrder(
  order: {
    waiterId: string;
    status: OrderStatus;
    paidAmount: number;
    paymentStatus: PaymentStatus;
  },
  waiterId: string,
): boolean {
  return (
    order.waiterId === waiterId &&
    order.status !== OrderStatus.CANCELLED &&
    order.paidAmount === 0 &&
    order.paymentStatus === PaymentStatus.UNPAID
  );
}

export function draftCartFromOrder(
  previous: {
    waiterId: string;
    tableId: string;
    items: { productId: string; quantity: number }[];
  } | null,
  waiterId: string,
  catalog: { id: string }[],
) {
  if (!previous || previous.waiterId !== waiterId) {
    return { tableId: undefined as string | undefined, lines: [] as { productId: string; quantity: number }[] };
  }
  const available = new Set(catalog.map((product) => product.id));
  return {
    tableId: previous.tableId,
    lines: previous.items
      .filter((item) => available.has(item.productId))
      .map((item) => ({ productId: item.productId, quantity: item.quantity })),
  };
}
