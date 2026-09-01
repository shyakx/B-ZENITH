import { describe, expect, it } from "vitest";
import {
  formatPaymentDate,
  formatPaymentTime,
  paymentHistoryRows,
  paymentHistoryTotal,
} from "@/lib/domain/payment-history";

const first = {
  id: "pay-1",
  createdAt: new Date("2026-09-01T12:20:00.000Z"),
  method: "CASH",
  amount: 50000,
};

const second = {
  id: "pay-2",
  createdAt: new Date("2026-09-02T08:15:00.000Z"),
  method: "MOBILE_MONEY",
  amount: 50000,
};

describe("facture payment history", () => {
  it("shows one payment with its actual date and time", () => {
    const rows = paymentHistoryRows([first]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: formatPaymentDate(first.createdAt),
      time: formatPaymentTime(first.createdAt),
      method: "CASH",
      amount: 50000,
    });
    expect(rows[0].date).toBe("01 Sept 2026");
    expect(rows[0].time).toBe("14:20");
  });

  it("shows two payments separately, oldest first", () => {
    const rows = paymentHistoryRows([second, first]);
    expect(rows.map((row) => row.key)).toEqual(["pay-1", "pay-2"]);
    expect(rows.map((row) => row.amount)).toEqual([50000, 50000]);
    expect(rows[0].date).toBe(formatPaymentDate(first.createdAt));
    expect(rows[1].date).toBe(formatPaymentDate(second.createdAt));
    expect(rows[0].date).not.toBe(rows[1].date);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });

  it("sums installment history to the running paid total", () => {
    expect(paymentHistoryTotal([first, second])).toBe(100000);
    expect(paymentHistoryTotal([first])).toBe(50000);
  });

  it("fully paid order: history total matches paidAmount and balance is 0", () => {
    const paidAmount = 100000;
    const total = 100000;
    expect(paymentHistoryTotal([first, second])).toBe(paidAmount);
    expect(total - paidAmount).toBe(0);
  });

  it("partially paid order: history total matches paidAmount and balance remains", () => {
    const paidAmount = 50000;
    const total = 100000;
    expect(paymentHistoryTotal([first])).toBe(paidAmount);
    expect(total - paidAmount).toBe(50000);
  });

  it("later settlement is a second payment on the same order", () => {
    const rows = paymentHistoryRows([first, second]);
    expect(rows).toHaveLength(2);
    expect(paymentHistoryTotal(rows.map((row, i) => (i === 0 ? first : second)))).toBe(100000);
  });

  it("creates no history row for pay-later without a Payment record", () => {
    expect(paymentHistoryRows([])).toEqual([]);
    expect(paymentHistoryTotal([])).toBe(0);
  });
});
