import { describe, expect, it } from "vitest";
import { compatibilityStockTotal, legacyStockToLocations } from "@/lib/domain/locations";
import {
  assertAllowedV1Transfer,
  assertNonNegativeStock,
  convertPackToBase,
  isLowStock,
  nextStockAfterAdjustment,
  nextStockAfterCount,
  nextStockAfterIncrease,
  nextStockAfterSale,
  nextStockAfterTransferOut,
  nextStockAfterWaste,
  assertReceiptDestination,
  saleStockMessage,
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
    expect(() => assertNonNegativeStock(-1)).toThrow(/negative/);
  });

  it("applies adjustments and counts", () => {
    expect(nextStockAfterAdjustment(10, -2)).toBe(8);
    expect(nextStockAfterAdjustment(10, 4)).toBe(14);
    expect(nextStockAfterCount(7)).toEqual({ next: 7 });
    expect(() => nextStockAfterCount(-1)).toThrow(/negative/);
  });

  it("flags low stock only for tracked products", () => {
    expect(isLowStock(true, 3)).toBe(true);
    expect(isLowStock(false, 0)).toBe(false);
  });

  it("converts pack quantity using the product pack factor, never a hardcoded crate size", () => {
    expect(convertPackToBase(2, 30)).toBe(60);
    expect(() => convertPackToBase(2, 0)).toThrow(/positive/);
    expect(() => convertPackToBase(2, -4)).toThrow(/positive/);
    expect(() => convertPackToBase(0, 30)).toThrow(/positive/);
  });


  it("rejects a transfer that would overdraw the source location", () => {
    expect(nextStockAfterTransferOut(70, 30)).toBe(40);
    expect(() => nextStockAfterTransferOut(70, 100)).toThrow(/enough stock to transfer/);
  });

  it("rejects receiving into an operational location", () => {
    expect(() => assertReceiptDestination("MAIN")).not.toThrow();
    expect(() => assertReceiptDestination("BAR")).toThrow(/Main Stock/);
  });

  it("allows only MAIN to operational transfers in v1", () => {
    expect(() => assertAllowedV1Transfer("MAIN", "BAR")).not.toThrow();
    expect(() => assertAllowedV1Transfer("MAIN", "KITCHEN")).not.toThrow();
    expect(() => assertAllowedV1Transfer("MAIN", "CAFE")).not.toThrow();
    expect(() => assertAllowedV1Transfer("BAR", "MAIN")).toThrow(/Main Stock/);
    expect(() => assertAllowedV1Transfer("BAR", "KITCHEN")).toThrow(/Main Stock/);
    expect(() => assertAllowedV1Transfer("MAIN", "MAIN")).toThrow(/different/);
  });

  it("puts legacy stock on MAIN only", () => {
    expect(legacyStockToLocations(40)).toEqual({ MAIN: 40, BAR: 0, KITCHEN: 0, CAFE: 0 });
    expect(legacyStockToLocations(0)).toEqual({ MAIN: 0, BAR: 0, KITCHEN: 0, CAFE: 0 });
    expect(compatibilityStockTotal([{ quantity: 70 }, { quantity: 30 }, { quantity: 0 }, { quantity: 0 }])).toBe(100);
  });

  it("names the operational location in sale shortage messages", () => {
    expect(saleStockMessage("Fanta", "Bar", 0)).toMatch(/Bar stock for Fanta/);
    expect(saleStockMessage("Fanta", "Bar", 0)).toMatch(/Main Stock first/);
  });
});
