import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inventoryGroupId, isDrinkUnit, isFoodUnit, stockDestination } from "./inventory-groups";
import { isAddStockItem, isReceivableDrink, isStockPageProduct } from "./stock";

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

  it("identifies sealed drink units for 1:1 bottle sales, not Add Stock eligibility", () => {
    assert.equal(isReceivableDrink("BOTTLE"), true);
    assert.equal(isReceivableDrink("CAN"), true);
    assert.equal(isReceivableDrink("PLATE"), false);
    assert.equal(isReceivableDrink("PORTION"), false);
    assert.equal(isReceivableDrink("GLASS"), false);
    assert.equal(isReceivableDrink("PIECE", "Drinks"), true);
    assert.equal(isReceivableDrink("PLATE", "Food"), false);
  });

  it("puts physical drinks and raw stock on Add Stock, not menu dishes", () => {
    const catalog = [
      { name: "Coca Cola", categoryName: "Drinks", unit: "BOTTLE", trackInventory: true, sku: "COLA" },
      { name: "Rice", categoryName: "Dry Goods", unit: "KG", trackInventory: true, sku: "STK-RICE" },
      { name: "Chicken Brochette", categoryName: "Brochettes", unit: "PORTION", trackInventory: true, sku: "BROCH" },
      { name: "House Burger", categoryName: "Burger", unit: "PLATE", trackInventory: false, sku: "BURGER" },
      { name: "Roasted Potatoes", categoryName: "Side Dishes", unit: "PORTION", trackInventory: false, sku: "POTATO" },
      { name: "Service fee", categoryName: "Other", unit: "OTHER", trackInventory: false, sku: "FEE" },
      { name: "Deleted item", categoryName: "Drinks", unit: "BOTTLE", trackInventory: true, sku: "__del__.OLD" },
    ];
    const addable = catalog.filter(isAddStockItem).map((item) => item.name);
    assert.deepEqual(addable, ["Coca Cola", "Rice"]);
    assert.equal(isStockPageProduct({ unit: "PORTION", sku: "BROCH" }), true);
    assert.equal(isAddStockItem({ trackInventory: false, unit: "PORTION" }), false);
    assert.equal(isAddStockItem({ trackInventory: true, unit: "OTHER" }), false);
  });
});
