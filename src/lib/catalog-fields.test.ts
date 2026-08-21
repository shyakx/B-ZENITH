import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogProductWriteData, newProductStockQuantity } from "./catalog-fields";

describe("catalog writes", () => {
  it("never includes stockQuantity when updating menu fields", () => {
    const data = catalogProductWriteData({
      name: "House Burger",
      sku: "BZ-FOOD-BURGER",
      categoryId: "cat1",
      description: "Updated description",
      costPrice: 2000,
      sellingPrice: 8000,
      unit: "PLATE",
      active: true,
      trackInventory: false,
    });
    assert.equal("stockQuantity" in data, false);
    assert.equal(data.name, "House Burger");
    assert.equal(data.sellingPrice, 8000);
    assert.equal(newProductStockQuantity(), 0);
  });

  it("ignores a spoofed stock field on the input object", () => {
    const data = catalogProductWriteData({
      name: "Cola",
      categoryId: "cat2",
      costPrice: 500,
      sellingPrice: 1500,
      unit: "BOTTLE",
      active: true,
      trackInventory: true,
      ...({ stockQuantity: 99 } as object),
    } as never);
    assert.equal("stockQuantity" in data, false);
  });
});
