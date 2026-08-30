import { describe, expect, it } from "vitest";
import { formatRwf, lineTotal, remainingBalance, sumLineTotals } from "@/lib/domain/money";

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
    expect(formatRwf(18000)).toBe("18,000 RWF");
  });
});
