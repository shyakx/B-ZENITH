export function dailyBusinessTotals(
  ordersCreated: { total: number }[],
  paymentsReceived: { amount: number }[],
) {
  return {
    ordersToday: ordersCreated.length,
    salesToday: ordersCreated.reduce((sum, order) => sum + order.total, 0),
    paidToday: paymentsReceived.reduce((sum, payment) => sum + payment.amount, 0),
  };
}

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
