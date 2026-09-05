import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  costTimesQuantity,
  formatRwf,
  formatRwfAmount,
  formatRwfPerUnit,
  lineTotal,
  remainingBalance,
  sumLineTotals,
  unitCostFromTotalPrice,
} from "@/lib/domain/money";

describe("money", () => {
  it("computes line and order totals", () => {
    expect(lineTotal(3000, 2)).toBe(6000);
    expect(
      sumLineTotals([
        { unitPrice: 1500, quantity: 2 },
        { unitPrice: 8000, quantity: 1 },
        { unitPrice: 3000, quantity: 1 },
      ]),
    ).toBe(14000);
  });

  it("keeps remaining balances accurate", () => {
    expect(remainingBalance(18000, 0)).toBe(18000);
    expect(remainingBalance(18000, 8000)).toBe(10000);
    expect(remainingBalance(18000, 18000)).toBe(0);
    expect(remainingBalance(18000, 20000)).toBe(0);
  });

  it("formats RWF", () => {
    expect(formatRwfAmount(18000)).toBe("18,000");
    expect(formatRwf(18000)).toBe("18,000 RWF");
  });

  it("calculates fractional unit cost from total price paid", () => {
    expect(unitCostFromTotalPrice(2500, 1).eq(2500)).toBe(true);
    expect(unitCostFromTotalPrice(100000, 40).eq(2500)).toBe(true);
    expect(unitCostFromTotalPrice(100000, 60).eq(new Prisma.Decimal(100000).div(60))).toBe(true);
    expect(unitCostFromTotalPrice(1000, 30).eq(new Prisma.Decimal(1000).div(30))).toBe(true);
    expect(() => unitCostFromTotalPrice(0, 60)).toThrow(/greater than 0/);
    expect(() => unitCostFromTotalPrice(-100, 60)).toThrow(/greater than 0/);
    expect(() => unitCostFromTotalPrice(100000, 0)).toThrow(/greater than 0/);
  });

  it("values inventory with decimal last cost without changing quantity", () => {
    expect(costTimesQuantity(unitCostFromTotalPrice(100000, 60), 60).eq(100000)).toBe(true);
    expect(formatRwfPerUnit(unitCostFromTotalPrice(100000, 60))).toBe("1,666.67 RWF");
  });
});
