import type { PaymentStatus } from "@/lib/domain/payments";

export function cashierShiftStats(
  openOrders: { paymentStatus: PaymentStatus }[],
  outstandingCount: number,
  cashPayments: { amount: number; method: string }[],
) {
  return {
    unpaidBills: openOrders.filter((order) => order.paymentStatus === "UNPAID").length,
    partialBills: openOrders.filter((order) => order.paymentStatus === "PARTIALLY_PAID").length,
    payLater: outstandingCount,
    cashReceivedToday: cashPayments
      .filter((payment) => payment.method === "CASH")
      .reduce((sum, payment) => sum + payment.amount, 0),
  };
}
