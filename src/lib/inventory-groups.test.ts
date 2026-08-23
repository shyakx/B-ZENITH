import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inventoryGroupId, isDrinkUnit, isFoodUnit, stockDestination } from "./inventory-groups";

describe("inventory display groups", () => {
  it("puts bottled and canned drinks on Bar — drinks", () => {
    assert.equal(inventoryGroupId({ sellingLocationCode: "BAR", unit: "BOTTLE" }), "BAR_DRINKS");
    assert.equal(inventoryGroupId({ sellingLocationCode: "BAR", unit: "CAN" }), "BAR_DRINKS");
    assert.equal(isDrinkUnit("BOTTLE"), true);
  });

  it("puts plates and portions on Kitchen — food", () => {
    assert.equal(inventoryGroupId({ sellingLocationCode: "KITCHEN", unit: "PLATE" }), "KITCHEN_FOOD");
    assert.equal(inventoryGroupId({ sellingLocationCode: "KITCHEN", unit: "PORTION" }), "KITCHEN_FOOD");
    assert.equal(isFoodUnit("PLATE"), true);
  });

  it("keeps bar snacks separate from drinks", () => {
    assert.equal(inventoryGroupId({ sellingLocationCode: "BAR", unit: "PIECE" }), "BAR_OTHER");
  });

  it("keeps kitchen drinks separate from food", () => {
    assert.equal(inventoryGroupId({ sellingLocationCode: "KITCHEN", unit: "BOTTLE" }), "KITCHEN_OTHER");
  });

  it("routes stock to Bar or Kitchen, not by menu category", () => {
    assert.equal(stockDestination({ sellingLocationCode: "BAR", unit: "BOTTLE" }), "BAR");
    assert.equal(stockDestination({ sellingLocationCode: "KITCHEN", unit: "PLATE" }), "KITCHEN");
    assert.equal(stockDestination({ sellingLocationCode: null, unit: "PIECE" }), "UNASSIGNED");
  });
});
