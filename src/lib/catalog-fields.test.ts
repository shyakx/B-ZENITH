import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogProductWriteData, newProductStockQuantity, authorizeProductDelete, isDeletedProductSku, PRODUCT_DELETE_DENIED_MESSAGE } from "./catalog-fields";

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

  it("allows OWNER and ADMIN to delete products, but not MANAGER", () => {
    assert.equal(authorizeProductDelete("ADMIN").ok, true);
    assert.equal(authorizeProductDelete("OWNER").ok, true);
    const denied = authorizeProductDelete("MANAGER");
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.error, PRODUCT_DELETE_DENIED_MESSAGE);
    assert.equal(isDeletedProductSku("__del__.abc"), true);
    assert.equal(isDeletedProductSku("BZ-FOOD-BURGER"), false);
  });
});
