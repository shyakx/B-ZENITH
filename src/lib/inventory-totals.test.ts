import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableTotal,
  existingStockMigratesToMain,
  movementTotals,
  overviewStatus,
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

  it("computes total available as Main + Bar + Kitchen", () => {
    assert.equal(availableTotal(120, 35, 0), 155);
    assert.equal(availableTotal(100, 20, 10), 130);
  });

  it("keeps total available unchanged when transferring Main to Bar or Kitchen", () => {
    const before = { main: 100, bar: 20, kitchen: 10 };
    const afterBar = { main: before.main - 15, bar: before.bar + 15, kitchen: before.kitchen };
    const afterKitchen = { main: before.main - 8, bar: before.bar, kitchen: before.kitchen + 8 };
    assert.equal(availableTotal(afterBar.main, afterBar.bar, afterBar.kitchen), availableTotal(before.main, before.bar, before.kitchen));
    assert.equal(availableTotal(afterKitchen.main, afterKitchen.bar, afterKitchen.kitchen), 130);
  });

  it("does not treat transfers as received, sold, or wasted", () => {
    const afterTransfer = movementTotals([
      { type: "PURCHASE", quantity: 100 },
      { type: "TRANSFER_OUT", quantity: -15 },
      { type: "TRANSFER_IN", quantity: 15 },
    ]);
    assert.equal(afterTransfer.supplied, 100);
    assert.equal(afterTransfer.sold, 0);
    assert.equal(afterTransfer.wasted, 0);
    assert.equal(afterTransfer.transferredOut, 15);
    assert.equal(afterTransfer.transferredIn, 15);
  });

  it("maps overview status without inventing a low-stock threshold of zero", () => {
    assert.equal(overviewStatus(0, 5), "OUT_OF_STOCK");
    assert.equal(overviewStatus(3, 5), "LOW_STOCK");
    assert.equal(overviewStatus(3, 0), "IN_STOCK");
    assert.equal(overviewStatus(20, 5), "IN_STOCK");
  });
});
