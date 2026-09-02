/**
 * Today’s dashboard (Owner / Manager) is sale-dated:
 * non-cancelled orders created on the Kigali business day.
 *
 * Paid today = how much of those sales is already collected (`Order.paidAmount`).
 * Outstanding = the unpaid remainder of those same sales.
 *
 * Cash collected on a payment timestamp (including older bills paid today) is a
 * different number. That stays on the cashier home as “Cash received today”
 * via `sumPaymentsReceived`, and on reports as “Payments received”.
 */
export type TodaySalesSnapshot = {
  ordersToday: number;
  salesToday: number;
  paidToday: number;
  outstanding: number;
};

export function reconcileTodaySales(
  orders: { total: number; paidAmount: number }[],
): TodaySalesSnapshot {
  const salesToday = orders.reduce((sum, order) => sum + order.total, 0);
  const paidToday = orders.reduce((sum, order) => sum + order.paidAmount, 0);
  return {
    ordersToday: orders.length,
    salesToday,
    paidToday,
    outstanding: salesToday - paidToday,
  };
}

/** All-time unpaid bills + unsettled credit. Used on reports, not the today cards. */
export function currentOutstandingAmount(
  payableOrders: { total: number; paidAmount: number }[],
  credits: { amountOwed: number }[],
) {
  const openDue = payableOrders.reduce(
    (sum, order) => sum + Math.max(0, order.total - order.paidAmount),
    0,
  );
  const creditDue = credits.reduce((sum, credit) => sum + credit.amountOwed, 0);
  return openDue + creditDue;
}
