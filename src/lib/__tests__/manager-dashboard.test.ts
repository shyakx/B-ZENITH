import { describe, expect, it } from "vitest";
import { formatDate, rwandaDayRange } from "@/lib/dates";
import { currentOutstandingAmount, dailyBusinessTotals } from "@/lib/manager-dashboard";

describe("manager dashboard numbers", () => {
  it("counts today's orders and sales from order timestamps", () => {
    const totals = dailyBusinessTotals(
      [
        { total: 24000 },
        { total: 15000 },
      ],
      [{ amount: 5000 }],
    );
    expect(totals).toEqual({
      ordersToday: 2,
      salesToday: 39000,
      paidToday: 5000,
    });
  });

  it("uses payment timestamps for cash received, not the order date", () => {
    const orderAt1155 = new Date("2026-08-30T21:55:00.000Z");
    const paymentAt1205 = new Date("2026-08-30T22:05:00.000Z");
    const august30 = rwandaDayRange("2026-08-30");
    const august31 = rwandaDayRange("2026-08-31");

    expect(formatDate(orderAt1155)).toBe("August 30, 2026");
    expect(formatDate(paymentAt1205)).toBe("August 31, 2026");
    expect(orderAt1155.getTime()).toBeLessThanOrEqual(august30.to.getTime());
    expect(paymentAt1205.getTime()).toBeGreaterThanOrEqual(august31.from.getTime());

    expect(dailyBusinessTotals([{ total: 24000 }], [])).toEqual({
      ordersToday: 1,
      salesToday: 24000,
      paidToday: 0,
    });
    expect(dailyBusinessTotals([], [{ amount: 24000 }])).toEqual({
      ordersToday: 0,
      salesToday: 0,
      paidToday: 24000,
    });
  });

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
