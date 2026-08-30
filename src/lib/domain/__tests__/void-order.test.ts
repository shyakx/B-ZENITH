import { OrderStatus, PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canWaiterVoidOrder, draftCartFromOrder } from "@/lib/domain/void-order";
import { hasPermission } from "@/lib/auth/roles";

const unpaid = {
  waiterId: "john",
  status: OrderStatus.OPEN,
  paidAmount: 0,
  paymentStatus: PaymentStatus.UNPAID,
};

describe("waiter void eligibility", () => {
  it("allows a waiter to void their own unpaid order", () => {
    expect(canWaiterVoidOrder(unpaid, "john")).toBe(true);
  });

  it("rejects another waiter's order", () => {
    expect(canWaiterVoidOrder(unpaid, "mary")).toBe(false);
  });

  it("rejects a partially paid order", () => {
    expect(
      canWaiterVoidOrder(
        { ...unpaid, paidAmount: 5000, paymentStatus: PaymentStatus.PARTIALLY_PAID },
        "john",
      ),
    ).toBe(false);
  });

  it("rejects a fully paid order", () => {
    expect(
      canWaiterVoidOrder({ ...unpaid, paidAmount: 10000, paymentStatus: PaymentStatus.PAID }, "john"),
    ).toBe(false);
  });

  it("rejects an already cancelled order so stock cannot be restored twice", () => {
    expect(canWaiterVoidOrder({ ...unpaid, status: OrderStatus.CANCELLED }, "john")).toBe(false);
  });

  it("does not give the waiter cashier cancel or payment permissions", () => {
    expect(hasPermission("WAITER", "cancelOrder")).toBe(false);
    expect(hasPermission("WAITER", "recordPayment")).toBe(false);
    expect(hasPermission("CASHIER", "cancelOrder")).toBe(true);
  });
});

describe("order again draft", () => {
  const previous = {
    waiterId: "john",
    tableId: "table-7",
    items: [
      { productId: "heineken", quantity: 5 },
      { productId: "gone", quantity: 1 },
    ],
  };

  it("loads items into a new cart without creating an order", () => {
    const draft = draftCartFromOrder(previous, "john", [{ id: "heineken" }]);
    expect(draft.tableId).toBe("table-7");
    expect(draft.lines).toEqual([{ productId: "heineken", quantity: 5 }]);
  });

  it("does not change the previous order when the cart quantity is edited", () => {
    const draft = draftCartFromOrder(previous, "john", [{ id: "heineken" }]);
    const edited = draft.lines.map((line) =>
      line.productId === "heineken" ? { ...line, quantity: 2 } : line,
    );
    expect(previous.items[0].quantity).toBe(5);
    expect(edited).toEqual([{ productId: "heineken", quantity: 2 }]);
  });

  it("does not load another waiter's order into the cart", () => {
    expect(draftCartFromOrder(previous, "mary", [{ id: "heineken" }]).lines).toEqual([]);
  });
});
