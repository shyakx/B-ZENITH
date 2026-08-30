import { describe, expect, it } from "vitest";
import { cashierShiftStats } from "@/lib/cashier-dashboard";

describe("cashier shift stats", () => {
  it("counts unpaid, partial, pay later, and cash received today", () => {
    expect(
      cashierShiftStats(
        [
          { paymentStatus: "UNPAID" },
          { paymentStatus: "UNPAID" },
          { paymentStatus: "PARTIALLY_PAID" },
        ],
        4,
        [
          { amount: 85000, method: "CASH" },
          { amount: 20000, method: "CASH" },
          { amount: 5000, method: "MOBILE_MONEY" },
        ],
      ),
    ).toEqual({
      unpaidBills: 2,
      partialBills: 1,
      payLater: 4,
      cashReceivedToday: 105000,
    });
  });
});
