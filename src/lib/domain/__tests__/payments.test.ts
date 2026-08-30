import { describe, expect, it } from "vitest";
import {
  allocateAcrossOrders,
  combinedBill,
  isOrderPayable,
  paymentStatusAfterAmount,
  validatePaymentAmount,
  type PayableOrder,
} from "@/lib/domain/payments";

const table7: PayableOrder[] = [
  { id: "a", orderNumber: 1045, total: 15000, paidAmount: 0, paymentStatus: "UNPAID" },
  { id: "b", orderNumber: 1048, total: 22000, paidAmount: 0, paymentStatus: "UNPAID" },
  { id: "c", orderNumber: 1051, total: 10000, paidAmount: 0, paymentStatus: "UNPAID" },
];

describe("payments", () => {
  it("sets simple payment statuses", () => {
    expect(paymentStatusAfterAmount(18000, 0)).toBe("UNPAID");
    expect(paymentStatusAfterAmount(18000, 5000)).toBe("PARTIALLY_PAID");
    expect(paymentStatusAfterAmount(18000, 18000)).toBe("PAID");
    expect(paymentStatusAfterAmount(18000, 0, true)).toBe("PAY_LATER");
  });

  it("records a partial payment without exceeding the balance", () => {
    expect(validatePaymentAmount(18000, 0, 8000)).toEqual({
      remainingBefore: 18000,
      remainingAfter: 10000,
    });
    expect(() => validatePaymentAmount(18000, 0, 20000)).toThrow(/larger/);
    expect(() => validatePaymentAmount(18000, 18000, 1000)).toThrow(/already paid/);
  });

  it("prevents a duplicate overpayment on a paid bill", () => {
    expect(isOrderPayable("PAID")).toBe(false);
    expect(isOrderPayable("UNPAID")).toBe(true);
  });

  it("allocates a table payment across waiter orders without merging them", () => {
    expect(allocateAcrossOrders(table7, 47000)).toEqual([
      { orderId: "a", amount: 15000 },
      { orderId: "b", amount: 22000 },
      { orderId: "c", amount: 10000 },
    ]);
    expect(allocateAcrossOrders(table7, 20000)).toEqual([
      { orderId: "a", amount: 15000 },
      { orderId: "b", amount: 5000 },
    ]);
  });

  it("keeps a combined table bill while orders stay separate", () => {
    expect(combinedBill(table7)).toEqual({
      total: 47000,
      paid: 0,
      remaining: 47000,
      status: "UNPAID",
    });
  });

  it("pays the oldest unpaid order first and leaves later orders untouched", () => {
    expect(
      allocateAcrossOrders(
        [
          { id: "1042", orderNumber: 1042, total: 20000, paidAmount: 0, paymentStatus: "UNPAID" },
          { id: "1043", orderNumber: 1043, total: 15000, paidAmount: 0, paymentStatus: "UNPAID" },
          { id: "1044", orderNumber: 1044, total: 8000, paidAmount: 0, paymentStatus: "UNPAID" },
        ],
        20000,
      ),
    ).toEqual([{ orderId: "1042", amount: 20000 }]);
  });

  it("rejects zero and negative payments", () => {
    expect(() => validatePaymentAmount(18000, 0, 0)).toThrow(/positive/);
    expect(() => validatePaymentAmount(18000, 0, -1000)).toThrow(/positive/);
  });
});

