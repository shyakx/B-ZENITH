import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatQuantity,
  isAddStockItem,
  isMenuCatalogProduct,
  isPhysicalStockProduct,
  isStockPageProduct,
  matchesCatalogKind,
  matchesStockType,
} from "./stock";

describe("stock page catalogue", () => {
  it("treats sealed drinks and raw ingredients as physical stock", () => {
    assert.equal(isPhysicalStockProduct({ unit: "BOTTLE", sku: "H" }), true);
    assert.equal(isPhysicalStockProduct({ unit: "CAN", sku: "RB" }), true);
    assert.equal(isPhysicalStockProduct({ unit: "KG", sku: "RICE" }), true);
    assert.equal(isPhysicalStockProduct({ unit: "PIECE", sku: "STK-EGGS" }), true);
    assert.equal(isPhysicalStockProduct({ unit: "PORTION", seedKey: "physical-stock::Meat::Beef" }), true);
  });

  it("does not treat prepared menu dishes as physical stock", () => {
    assert.equal(isPhysicalStockProduct({ unit: "PORTION", sku: "STEW", seedKey: "Beef Dishes::Beef Stew" }), false);
    assert.equal(isMenuCatalogProduct({ unit: "PORTION", sku: "STEW", seedKey: "Beef Dishes::Beef Stew" }), true);
    assert.equal(isPhysicalStockProduct({ unit: "GLASS", sku: "GIN" }), false);
    assert.equal(isAddStockItem({ unit: "PORTION", sku: "ESP" }), false);
  });

  it("keeps Add Stock on physical items, including zero-qty kitchen stock", () => {
    const catalog = [
      { name: "Heineken", categoryName: "Drinks", unit: "BOTTLE", sku: "H" },
      { name: "Rice", categoryName: "Dry Goods", unit: "KG", sku: "STK-RICE" },
      { name: "Ibirayi", categoryName: "Vegetables", unit: "KG", sku: "STK-IBIRAYI" },
      { name: "Take Away Paper", categoryName: "Packaging & Consumables", unit: "PIECE", sku: "STK-PAPER" },
      { name: "Beef Stew", categoryName: "Beef Dishes", unit: "PORTION", sku: "STEW" },
      { name: "Espresso Single", categoryName: "Coffee", unit: "PORTION", sku: "ESP" },
      { name: "Gin Tonic", categoryName: "Cocktail", unit: "PORTION", sku: "GT" },
      { name: "Service fee", categoryName: "Other", unit: "OTHER", sku: "FEE" },
      { name: "Deleted", categoryName: "Drinks", unit: "BOTTLE", sku: "__del__.OLD" },
    ];
    const addable = catalog.filter(isAddStockItem).map((item) => item.name);
    assert.deepEqual(addable, ["Heineken", "Rice", "Ibirayi", "Take Away Paper"]);
    assert.equal(matchesCatalogKind(catalog[4]!, "STOCK"), false);
    assert.equal(matchesCatalogKind(catalog[1]!, "STOCK"), true);
    assert.equal(isStockPageProduct(catalog[4]!), true);
  });

  it("groups type filters by ordinary stock kinds", () => {
    assert.equal(matchesStockType("Vegetables", "KITCHEN"), true);
    assert.equal(matchesStockType("Drinks", "BAR"), true);
    assert.equal(matchesStockType("Café Ingredients", "CAFE"), true);
    assert.equal(matchesStockType("Packaging & Consumables", "PACKAGING"), true);
    assert.equal(matchesStockType("Spices & Seasoning", "INGREDIENTS"), true);
    assert.equal(matchesStockType("Mixers", "DRINKS"), true);
    assert.equal(matchesStockType("Beef Dishes", "KITCHEN"), false);
    assert.equal(matchesStockType("Vegetables", "ALL"), true);
  });

  it("formats units in ordinary language", () => {
    assert.equal(formatQuantity(25, "KG"), "25 KG");
    assert.equal(formatQuantity(10, "PIECE"), "10 PCS");
    assert.equal(formatQuantity(1, "BOTTLE"), "1 bottle");
    assert.equal(formatQuantity(24, "BOTTLE"), "24 bottles");
    assert.equal(formatQuantity(12, "CAN"), "12 cans");
    assert.equal(formatQuantity(0, "KG"), "0 KG");
  });
});
