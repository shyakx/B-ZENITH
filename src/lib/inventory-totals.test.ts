import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  existingStockMigratesToMain,
  movementTotals,
  stockStatus,
  totalsByProduct,
  validateWasteQuantity,
} from "./inventory-totals";

describe("inventory totals and opening stock", () => {
  it("moves existing product stock into MAIN STOCK only", () => {
    assert.deepEqual(existingStockMigratesToMain(48), { MAIN_STOCK: 48, BAR: 0, KITCHEN: 0 });
  });

  it("derives supplied, wasted, sold, and transferred totals from the ledger", () => {
    const totals = movementTotals([
      { type: "PURCHASE", quantity: 500 },
      { type: "TRANSFER_OUT", quantity: -24 },
      { type: "TRANSFER_IN", quantity: 24 },
      { type: "SALE", quantity: -10 },
      { type: "RETURN", quantity: 2 },
      { type: "WASTE", quantity: -5 },
      { type: "ADJUSTMENT", quantity: 3 },
      { type: "STOCK_TAKE", quantity: -1 },
    ]);
    assert.equal(totals.supplied, 500);
    assert.equal(totals.wasted, 5);
    assert.equal(totals.sold, 10);
    assert.equal(totals.returned, 2);
    assert.equal(totals.transferredOut, 24);
    assert.equal(totals.transferredIn, 24);
    assert.equal(totals.adjustments, 2);
  });

  it("blocks waste that would take a location below zero", () => {
    assert.equal(validateWasteQuantity(2, 3).ok, false);
    assert.equal(validateWasteQuantity(5, 2).ok, true);
  });

  it("counts each product movement once when composing overview totals", () => {
    const ledger: Array<{ productId: string; type: string; quantity: number }> = [
      { productId: "p1", type: "PURCHASE", quantity: 100 },
      { productId: "p1", type: "TRANSFER_OUT", quantity: -24 },
      { productId: "p1", type: "TRANSFER_IN", quantity: 24 },
      { productId: "p1", type: "SALE", quantity: -10 },
      { productId: "p1", type: "RETURN", quantity: 2 },
      { productId: "p1", type: "ADJUSTMENT", quantity: 1 },
      { productId: "p1", type: "STOCK_TAKE", quantity: -3 },
      { productId: "p1", type: "WASTE", quantity: -5 },
    ];
    const recent = ledger.slice(0, 3);
    const doubleCounted = movementTotals([...recent, ...ledger]);
    const once = totalsByProduct(ledger).get("p1")!;
    assert.equal(doubleCounted.supplied, 200);
    assert.equal(once.supplied, 100);
    assert.equal(once.wasted, 5);
    assert.equal(once.sold, 10);
    assert.equal(once.returned, 2);
    assert.equal(once.transferredOut, 24);
    assert.equal(once.transferredIn, 24);
    assert.equal(once.adjustments, -2);
  });

  it("marks oversold stock as negative for managers", () => {
    assert.equal(stockStatus(-2, 5), "NEGATIVE");
    assert.equal(stockStatus(0, 5), "ZERO");
    assert.equal(stockStatus(3, 5), "LOW");
    assert.equal(stockStatus(20, 5), "OK");
  });
});
