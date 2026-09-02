import { describe, expect, it } from "vitest";
import { formatDate, rwandaDayRange } from "@/lib/dates";
import { currentOutstandingAmount, reconcileTodaySales } from "@/lib/manager-dashboard";
import { cashierShiftStats } from "@/lib/cashier-dashboard";

describe("today dashboard sales reconciliation", () => {
  it("fully paid: sales = paid, outstanding = 0", () => {
    const snapshot = reconcileTodaySales([{ total: 100000, paidAmount: 100000 }]);
    expect(snapshot).toEqual({
      ordersToday: 1,
      salesToday: 100000,
      paidToday: 100000,
      outstanding: 0,
    });
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
  });

  it("completely unpaid: paid = 0, outstanding = sales", () => {
    const snapshot = reconcileTodaySales([{ total: 100000, paidAmount: 0 }]);
    expect(snapshot).toEqual({
      ordersToday: 1,
      salesToday: 100000,
      paidToday: 0,
      outstanding: 100000,
    });
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
  });

  it("partially paid: remainder is outstanding", () => {
    const snapshot = reconcileTodaySales([{ total: 100000, paidAmount: 40000 }]);
    expect(snapshot).toEqual({
      ordersToday: 1,
      salesToday: 100000,
      paidToday: 40000,
      outstanding: 60000,
    });
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
  });

  it("multiple orders: sums paid and remaining on the same population", () => {
    const snapshot = reconcileTodaySales([
      { total: 100000, paidAmount: 100000 },
      { total: 50000, paidAmount: 20000 },
    ]);
    expect(snapshot).toEqual({
      ordersToday: 2,
      salesToday: 150000,
      paidToday: 120000,
      outstanding: 30000,
    });
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
  });

  it("excludes cancelled orders from the snapshot population", () => {
    const live = [{ total: 100000, paidAmount: 100000 }];
    const snapshot = reconcileTodaySales(live);
    expect(snapshot).toEqual({
      ordersToday: 1,
      salesToday: 100000,
      paidToday: 100000,
      outstanding: 0,
    });
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
  });

  it("does not add a historical sale to today merely because it was paid today", () => {
    const todayOrders = [{ total: 128000, paidAmount: 68000 }];
    const snapshot = reconcileTodaySales(todayOrders);
    expect(snapshot.salesToday).toBe(128000);
    expect(snapshot.paidToday).toBe(68000);
    expect(snapshot.outstanding).toBe(60000);
    expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);

    const orderAt1155 = new Date("2026-08-30T21:55:00.000Z");
    const paymentAt1205 = new Date("2026-08-30T22:05:00.000Z");
    const august30 = rwandaDayRange("2026-08-30");
    const august31 = rwandaDayRange("2026-08-31");
    expect(formatDate(orderAt1155)).toBe("August 30, 2026");
    expect(formatDate(paymentAt1205)).toBe("August 31, 2026");
    expect(orderAt1155.getTime()).toBeLessThanOrEqual(august30.to.getTime());
    expect(paymentAt1205.getTime()).toBeGreaterThanOrEqual(august31.from.getTime());

    expect(reconcileTodaySales([])).toEqual({
      ordersToday: 0,
      salesToday: 0,
      paidToday: 0,
      outstanding: 0,
    });

    expect(
      cashierShiftStats([], 0, [{ amount: 24000, method: "CASH" }]).cashReceivedToday,
    ).toBe(24000);
  });

  it("keeps the Sales Today = Paid Today + Outstanding invariant", () => {
    const cases = [
      [{ total: 100000, paidAmount: 100000 }],
      [{ total: 100000, paidAmount: 0 }],
      [{ total: 100000, paidAmount: 40000 }],
      [
        { total: 100000, paidAmount: 100000 },
        { total: 50000, paidAmount: 20000 },
      ],
      [
        { total: 200000, paidAmount: 50000 },
        { total: 200000, paidAmount: 30000 },
      ],
      [{ total: 150000, paidAmount: 0 }],
      [{ total: 150000, paidAmount: 50000 }],
    ];
    for (const orders of cases) {
      const snapshot = reconcileTodaySales(orders);
      expect(snapshot.salesToday).toBe(snapshot.paidToday + snapshot.outstanding);
    }
  });
});

describe("reports outstanding (all-time, not the today cards)", () => {
  it("adds unpaid/partial balances and pay-later amounts", () => {
    expect(
      currentOutstandingAmount(
        [
          { total: 24000, paidAmount: 0 },
          { total: 15000, paidAmount: 5000 },
        ],
        [{ amountOwed: 8000 }],
      ),
    ).toBe(42000);
  });
});
