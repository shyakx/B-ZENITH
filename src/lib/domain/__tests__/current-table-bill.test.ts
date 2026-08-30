import { describe, expect, it } from "vitest";
import { combinedBill, currentTableBillOrders } from "@/lib/domain/payments";

type TableOrder = {
  id: string;
  orderNumber: number;
  waiter: string;
  status: string;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PAY_LATER";
  total: number;
  paidAmount: number;
};

const paidYesterday: TableOrder = {
  id: "900",
  orderNumber: 900,
  waiter: "John",
  status: "COMPLETED",
  paymentStatus: "PAID",
  total: 20000,
  paidAmount: 20000,
};

const unpaidToday: TableOrder = {
  id: "1001",
  orderNumber: 1001,
  waiter: "John",
  status: "OPEN",
  paymentStatus: "UNPAID",
  total: 24000,
  paidAmount: 0,
};

const partialToday: TableOrder = {
  id: "1002",
  orderNumber: 1002,
  waiter: "Mary",
  status: "OPEN",
  paymentStatus: "PARTIALLY_PAID",
  total: 15000,
  paidAmount: 5000,
};

const cancelled: TableOrder = {
  id: "880",
  orderNumber: 880,
  waiter: "John",
  status: "CANCELLED",
  paymentStatus: "UNPAID",
  total: 8000,
  paidAmount: 0,
};

describe("current table bill", () => {
  it("excludes a historical paid order and keeps the unpaid current order", () => {
    const current = currentTableBillOrders([paidYesterday, unpaidToday]);
    expect(current.map((order) => order.id)).toEqual(["1001"]);
  });

  it("includes a partial order and excludes a paid order", () => {
    const current = currentTableBillOrders([partialToday, paidYesterday]);
    expect(current.map((order) => order.id)).toEqual(["1002"]);
  });

  it("keeps unpaid orders from two waiters separate", () => {
    const maryUnpaid: TableOrder = { ...unpaidToday, id: "1003", orderNumber: 1003, waiter: "Mary" };
    const current = currentTableBillOrders([unpaidToday, maryUnpaid]);
    expect(current).toHaveLength(2);
    expect(current.map((order) => order.waiter).sort()).toEqual(["John", "Mary"]);
    expect(current.map((order) => order.orderNumber).sort()).toEqual([1001, 1003]);
  });

  it("never includes cancelled orders", () => {
    const current = currentTableBillOrders([cancelled, unpaidToday]);
    expect(current.map((order) => order.id)).toEqual(["1001"]);
  });

  it("is empty when the table only has historical paid or cancelled orders", () => {
    const current = currentTableBillOrders([paidYesterday, cancelled]);
    expect(current).toEqual([]);
    expect(combinedBill(current)).toEqual({
      total: 0,
      paid: 0,
      remaining: 0,
      status: "UNPAID",
    });
  });

  it("matches the cashier example totals without yesterday's paid order", () => {
    const current = currentTableBillOrders([paidYesterday, unpaidToday, partialToday]);
    expect(current.map((order) => order.orderNumber)).toEqual([1001, 1002]);
    expect(combinedBill(current)).toEqual({
      total: 39000,
      paid: 5000,
      remaining: 34000,
      status: "PARTIALLY_PAID",
    });
  });
});
