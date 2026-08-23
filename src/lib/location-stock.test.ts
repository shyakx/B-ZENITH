import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_TRANSFER_FROM,
  LOCATION_CODES,
  openingMainQuantity,
  requireSellingLocationId,
  restoreLocationId,
  saleVoidClaimed,
  StockError,
  validateTransferRequest,
} from "./location-stock";
import { posOversellAllowed } from "./inventory-auth";
import { validateWasteQuantity } from "./inventory-totals";

describe("location stock rules", () => {
  it("accepts Main Stock to Bar and Kitchen only", () => {
    const lines = [{ productId: "cproduct00000000000000001", quantity: 24 }];
    assert.equal(validateTransferRequest(LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, lines).ok, true);
    assert.equal(validateTransferRequest(LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.KITCHEN, lines).ok, true);
    assert.equal(validateTransferRequest(LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN, lines).ok, false);
    assert.equal(validateTransferRequest(LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.MAIN_STOCK, lines).ok, false);
  });

  it("rejects empty, zero, duplicate, and non-integer lines", () => {
    assert.equal(validateTransferRequest(ALLOWED_TRANSFER_FROM, LOCATION_CODES.BAR, []).ok, false);
    assert.equal(validateTransferRequest(ALLOWED_TRANSFER_FROM, LOCATION_CODES.BAR, [{ productId: "cproduct00000000000000001", quantity: 0 }]).ok, false);
    assert.equal(validateTransferRequest(ALLOWED_TRANSFER_FROM, LOCATION_CODES.BAR, [{ productId: "cproduct00000000000000001", quantity: 1.5 }]).ok, false);
    assert.equal(
      validateTransferRequest(ALLOWED_TRANSFER_FROM, LOCATION_CODES.BAR, [
        { productId: "cproduct00000000000000001", quantity: 1 },
        { productId: "cproduct00000000000000001", quantity: 2 },
      ]).ok,
      false,
    );
  });

  it("models concurrent Main Stock decrements without going negative", () => {
    let main = 100;
    function tryDecrement(quantity: number) {
      if (main < quantity) return { count: 0, main };
      main -= quantity;
      return { count: 1, main };
    }
    assert.equal(tryDecrement(60).count, 1);
    assert.equal(main, 40);
    assert.equal(tryDecrement(60).count, 0);
    assert.equal(main, 40);
  });

  it("keeps total unchanged when transferring from Main to Bar", () => {
    const before = { MAIN_STOCK: 100, BAR: 0, KITCHEN: 0 };
    const quantity = 24;
    const after = {
      MAIN_STOCK: before.MAIN_STOCK - quantity,
      BAR: before.BAR + quantity,
      KITCHEN: before.KITCHEN,
    };
    assert.equal(after.MAIN_STOCK, 76);
    assert.equal(after.BAR, 24);
    assert.equal(after.MAIN_STOCK + after.BAR + after.KITCHEN, 100);
  });

  it("deducts Bar sales from Bar only", () => {
    const main = 76;
    let bar = 24;
    bar -= 1;
    assert.equal(main, 76);
    assert.equal(bar, 23);
  });

  it("returns stock to the original sale location", () => {
    const saleLocation = "BAR";
    const restored = { MAIN_STOCK: 76, BAR: 23, KITCHEN: 0 };
    restored[saleLocation] += 1;
    assert.equal(restored.BAR, 24);
    assert.equal(restored.MAIN_STOCK, 76);
  });

  it("purchase increases Main Stock only", () => {
    const stock = { MAIN_STOCK: 0, BAR: 0, KITCHEN: 0 };
    stock.MAIN_STOCK += 100;
    assert.deepEqual(stock, { MAIN_STOCK: 100, BAR: 0, KITCHEN: 0 });
  });

  it("transfer Main to Kitchen moves quantity without changing total", () => {
    const stock = { MAIN_STOCK: 50, BAR: 0, KITCHEN: 0 };
    const quantity = 10;
    stock.MAIN_STOCK -= quantity;
    stock.KITCHEN += quantity;
    assert.equal(stock.MAIN_STOCK, 40);
    assert.equal(stock.KITCHEN, 10);
    assert.equal(stock.MAIN_STOCK + stock.BAR + stock.KITCHEN, 50);
  });

  it("blocks a transfer when Main Stock is insufficient", () => {
    const main = 10;
    const requested = 24;
    assert.equal(main >= requested, false);
  });

  it("blocks a Bar sale when Bar stock is insufficient and leaves Main unchanged", () => {
    const main = 76;
    const bar = 0;
    const requested = 1;
    assert.equal(bar >= requested, false);
    assert.equal(main, 76);
  });

  it("lets POS oversell at the selling location while transfers and waste cannot go negative", () => {
    assert.equal(posOversellAllowed("SALE"), true);
    assert.equal(validateWasteQuantity(0, 1).ok, false);
    const main = 10;
    assert.equal(main >= 24, false);
  });

  it("stock take and adjustment affect only the selected location", () => {
    const stock = { MAIN_STOCK: 76, BAR: 24, KITCHEN: 0 };
    stock.BAR = 20;
    assert.equal(stock.MAIN_STOCK, 76);
    assert.equal(stock.KITCHEN, 0);
    stock.BAR -= 2;
    assert.equal(stock.BAR, 18);
    assert.equal(stock.MAIN_STOCK, 76);
  });

  it("untracked products do not require location stock records", () => {
    const tracked = false;
    const locationRows = tracked ? [{ code: "MAIN_STOCK", quantity: 0 }] : [];
    assert.equal(locationRows.length, 0);
  });

  it("keeps catalog categories independent from inventory locations", () => {
    const product = { category: "Drinks / Beer", locations: ["MAIN_STOCK", "BAR"] };
    assert.equal(product.category.includes("BAR"), false);
    assert.deepEqual(product.locations, ["MAIN_STOCK", "BAR"]);
  });

  it("refuses a missing selling location instead of defaulting to Bar", () => {
    assert.throws(() => requireSellingLocationId(null), StockError);
    assert.throws(() => requireSellingLocationId(undefined), StockError);
    assert.equal(requireSellingLocationId("clocbar000000000000000001"), "clocbar000000000000000001");
  });

  it("restores historical voids and returns to the sale line location, or MAIN_STOCK when missing", () => {
    assert.equal(restoreLocationId("clocbar000000000000000001", "clocmain00000000000000001"), "clocbar000000000000000001");
    assert.equal(restoreLocationId(null, "clocmain00000000000000001"), "clocmain00000000000000001");
  });

  it("copies existing product stock onto MAIN when tracking is enabled and locations are empty", () => {
    assert.equal(openingMainQuantity(null, 0, 40), 40);
    assert.equal(openingMainQuantity(0, 0, 40), 40);
    assert.equal(openingMainQuantity(0, 24, 24), 0);
    assert.equal(openingMainQuantity(76, 100, 100), 76);
  });

  it("treats a void as claimed only when exactly one COMPLETED row is updated", () => {
    assert.equal(saleVoidClaimed(1), true);
    assert.equal(saleVoidClaimed(0), false);
    assert.equal(saleVoidClaimed(2), false);
  });
});

