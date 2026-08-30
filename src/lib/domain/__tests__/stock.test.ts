import { describe, expect, it } from "vitest";
import {
  isLowStock,
  nextStockAfterAdjustment,
  nextStockAfterCount,
  nextStockAfterIncrease,
  nextStockAfterSale,
  nextStockAfterWaste,
} from "@/lib/domain/stock";

describe("inventory", () => {
  it("increases stock on purchase", () => {
    expect(nextStockAfterIncrease(10, 6)).toBe(16);
  });

  it("decreases tracked stock on order", () => {
    expect(nextStockAfterSale(24, 2)).toBe(22);
  });

  it("decreases stock on waste", () => {
    expect(nextStockAfterWaste(12, 3)).toBe(9);
  });

  it("prevents negative stock", () => {
    expect(() => nextStockAfterSale(1, 2)).toThrow(/enough stock/);
    expect(() => nextStockAfterWaste(1, 2)).toThrow(/cannot exceed/);
    expect(() => nextStockAfterAdjustment(2, -3)).toThrow(/negative/);
  });

  it("applies adjustments and counts", () => {
    expect(nextStockAfterAdjustment(10, -2)).toBe(8);
    expect(nextStockAfterAdjustment(10, 4)).toBe(14);
    expect(nextStockAfterCount(7)).toEqual({ next: 7 });
  });

  it("flags low stock only for tracked products", () => {
    expect(isLowStock(true, 3)).toBe(true);
    expect(isLowStock(false, 0)).toBe(false);
  });
});
