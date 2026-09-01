import { describe, expect, it } from "vitest";
import {
  EXPECTED_KITCHEN_MATERIAL_COUNT,
  EXPECTED_PACKAGED_TRACKED_COUNT,
  assertCatalogIntegrity,
  flattenCatalogProducts,
} from "../../../../prisma/catalog-data";
import { KITCHEN_BASE_MATERIALS, KITCHEN_STORES_CATEGORY } from "@/lib/domain/kitchen-stores";

describe("kitchen stores catalog", () => {
  it("includes recipe items as tracked materials off POS", () => {
    assertCatalogIntegrity();
    const kitchen = flattenCatalogProducts().filter((product) => product.categoryName === KITCHEN_STORES_CATEGORY);
    expect(kitchen).toHaveLength(EXPECTED_KITCHEN_MATERIAL_COUNT);
    expect(kitchen).toHaveLength(KITCHEN_BASE_MATERIALS.length);
    expect(kitchen.every((product) => product.trackInventory)).toBe(true);
    expect(kitchen.every((product) => product.sellOnPos === false)).toBe(true);
    expect(kitchen.every((product) => product.productType === "RAW_MATERIAL")).toBe(true);
    expect(kitchen.every((product) => product.defaultLocationCode === "KITCHEN")).toBe(true);
    expect(kitchen.every((product) => product.sellingPrice === 0)).toBe(true);
    expect(kitchen.map((product) => product.name)).toEqual(
      expect.arrayContaining(["Chicken", "Charcoal", "Rice", "Beef", "Cooking Oil", "Onions"]),
    );
    const drinks = flattenCatalogProducts().filter((product) => product.productType === "PACKAGED_GOOD");
    expect(drinks).toHaveLength(EXPECTED_PACKAGED_TRACKED_COUNT);
  });
});
