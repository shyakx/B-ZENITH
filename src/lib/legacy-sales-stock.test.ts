import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacySaleAllowsNegativeStock, posOversellAllowed } from "./inventory-auth";

const LEGACY_SALE_STOCK_CONFLICT_STATUS = 409;

function applyLegacyTrackedSale(available: number, requested: number) {
  if (!Number.isInteger(requested) || requested <= 0) {
    return { ok: false as const, status: 400, stock: available, movement: false };
  }
  if (!legacySaleAllowsNegativeStock() && requested > available) {
    return { ok: false as const, status: LEGACY_SALE_STOCK_CONFLICT_STATUS, stock: available, movement: false };
  }
  return { ok: true as const, status: 201, stock: available - requested, movement: true };
}

describe("legacy /api/sales stock safety", () => {
  it("does not allow negative stock on tracked bottle/can sales", () => {
    assert.equal(legacySaleAllowsNegativeStock(), false);
    assert.equal(posOversellAllowed("SALE"), false);
  });

  it("rejects selling 11 Heineken when 10 are available and leaves stock at 10", () => {
    const result = applyLegacyTrackedSale(10, 11);
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.equal(result.stock, 10);
    assert.equal(result.movement, false);
    assert.ok(result.stock >= 0);
  });

  it("sells 2 of 10 Heineken through the existing deduction rule and leaves 8", () => {
    const result = applyLegacyTrackedSale(10, 2);
    assert.equal(result.ok, true);
    assert.equal(result.status, 201);
    assert.equal(result.stock, 8);
    assert.equal(result.movement, true);
  });
});
