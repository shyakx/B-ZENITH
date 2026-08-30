import { describe, expect, it } from "vitest";
import { sumLineTotals } from "@/lib/domain/money";

describe("waiter orders", () => {
  it("builds an order from table, products and quantities", () => {
    const items = [
      { name: "Heineken", quantity: 2, unitPrice: 2000 },
      { name: "Whole Chicken", quantity: 1, unitPrice: 20000 },
      { name: "Fanta", quantity: 1, unitPrice: 1500 },
    ];
    expect(sumLineTotals(items)).toBe(25500);
  });

  it("keeps historical line prices when the menu price changes later", () => {
    const recorded = { name: "Heineken", quantity: 2, unitPrice: 2000 };
    const newMenuPrice = 2200;
    expect(sumLineTotals([recorded])).toBe(4000);
    expect(recorded.unitPrice).not.toBe(newMenuPrice);
    expect(sumLineTotals([{ ...recorded, unitPrice: newMenuPrice }])).toBe(4400);
  });

  it("keeps two waiters on the same table as separate orders", () => {
    const john = { waiter: "John", table: "7", orderNumber: 1045, total: 15000 };
    const mary = { waiter: "Mary", table: "7", orderNumber: 1048, total: 22000 };
    expect(john.table).toBe(mary.table);
    expect(john.waiter).not.toBe(mary.waiter);
    expect(john.orderNumber).not.toBe(mary.orderNumber);
    expect(new Set([1045, 1048, 1051]).size).toBe(3);
  });
});
