import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReturnQuantity, netSaleAmounts, remainingQuantity, summarizeSales } from "./reporting";

function sale(overrides: Partial<Parameters<typeof netSaleAmounts>[0]> & { items?: Parameters<typeof netSaleAmounts>[0]["items"] }) {
  return {
    subtotal: 10000,
    tax: 0,
    discount: 0,
    total: 10000,
    items: [{ productName: "Burger", quantity: 2, returnedQuantity: 0, lineSubtotal: 10000 }],
    ...overrides,
  };
}

describe("returns and net reporting", () => {
  it("keeps a completed sale with no return at full value", () => {
    const amounts = netSaleAmounts(sale({}));
    assert.equal(amounts.grossTotal, 10000);
    assert.equal(amounts.netTotal, 10000);
    assert.equal(amounts.returnedTotal, 0);
  });

  it("excludes a fully returned sale from net revenue", () => {
    const amounts = netSaleAmounts(
      sale({
        items: [{ productName: "Burger", quantity: 2, returnedQuantity: 2, lineSubtotal: 10000 }],
      }),
    );
    assert.equal(amounts.netTotal, 0);
    assert.equal(amounts.returnedTotal, 10000);
  });

  it("nets a partial return at the original line price", () => {
    const amounts = netSaleAmounts(
      sale({
        items: [{ productName: "Burger", quantity: 2, returnedQuantity: 1, lineSubtotal: 10000 }],
      }),
    );
    assert.equal(amounts.netTotal, 5000);
    assert.equal(amounts.returnedTotal, 5000);
  });

  it("nets multiple partial returns without double subtraction", () => {
    const amounts = netSaleAmounts(
      sale({
        items: [{ productName: "Burger", quantity: 10, returnedQuantity: 3 + 2, lineSubtotal: 10000 }],
      }),
    );
    assert.equal(amounts.netTotal, 5000);
  });

  it("scales tax with remaining goods", () => {
    const amounts = netSaleAmounts(
      sale({
        subtotal: 10000,
        tax: 1800,
        total: 11800,
        items: [{ productName: "Burger", quantity: 2, returnedQuantity: 1, lineSubtotal: 10000 }],
      }),
    );
    assert.equal(amounts.netSubtotal, 5000);
    assert.equal(amounts.netTax, 900);
    assert.equal(amounts.netTotal, 5900);
  });

  it("never allows returned quantity above sold quantity", () => {
    assert.equal(canReturnQuantity(2, 0, 2), true);
    assert.equal(canReturnQuantity(2, 1, 1), true);
    assert.equal(canReturnQuantity(2, 2, 1), false);
    assert.equal(canReturnQuantity(2, 0, 3), false);
    assert.equal(canReturnQuantity(2, 0, 0), false);
    assert.equal(remainingQuantity(2, 5), 0);
  });

  it("summarizes gross, returns, and net without double counting", () => {
    const summary = summarizeSales([
      {
        createdAt: new Date("2026-08-21T10:00:00+02:00"),
        paymentMethod: "CASH",
        subtotal: 10000,
        tax: 0,
        discount: 0,
        total: 10000,
        items: [{ productName: "Burger", quantity: 1, returnedQuantity: 0, lineSubtotal: 10000, categoryName: "Food" }],
      },
      {
        createdAt: new Date("2026-08-21T11:00:00+02:00"),
        paymentMethod: "CASH",
        subtotal: 4000,
        tax: 0,
        discount: 0,
        total: 4000,
        items: [{ productName: "Cola", quantity: 2, returnedQuantity: 2, lineSubtotal: 4000, categoryName: "Drinks" }],
      },
    ]);
    assert.equal(summary.grossTotal, 14000);
    assert.equal(summary.returnedTotal, 4000);
    assert.equal(summary.netTotal, 10000);
    assert.equal(summary.products.get("Cola")?.quantity, 0);
    assert.equal(summary.products.get("Burger")?.quantity, 1);
  });
});
