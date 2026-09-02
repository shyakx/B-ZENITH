import { ProductType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { productTypeStaffHelp, productTypeStaffLabel } from "@/lib/product-type-labels";

describe("staff-facing product type wording", () => {
  it("does not expose database enum names to ordinary staff", () => {
    expect(productTypeStaffLabel(ProductType.MENU_ITEM)).toBe("Menu product");
    expect(productTypeStaffLabel(ProductType.PACKAGED_GOOD)).toBe("Bottled / packaged for sale");
    expect(productTypeStaffLabel(ProductType.RAW_MATERIAL)).toBe("Stock item (not sold)");
    expect(productTypeStaffLabel(ProductType.PACKAGED_GOOD)).not.toContain("Packaged good");
    expect(productTypeStaffLabel(ProductType.RAW_MATERIAL)).not.toContain("Raw material");
  });

  it("shows a distinct helper for each type, and the stock-item helper only for stock items", () => {
    const menu = productTypeStaffHelp(ProductType.MENU_ITEM);
    const packaged = productTypeStaffHelp(ProductType.PACKAGED_GOOD);
    const stock = productTypeStaffHelp(ProductType.RAW_MATERIAL);

    expect(menu).toBe("Sold on POS. Use for what customers order from the menu.");
    expect(packaged).toBe("Sold on POS. The stock count is the bottle, can, or pack.");
    expect(stock).toBe(
      "Not sold on POS. Use for rice, oil, charcoal, soap, tissue, detergent, and other counted supplies.",
    );

    expect(menu).not.toEqual(packaged);
    expect(packaged).not.toEqual(stock);
    expect(menu).not.toMatch(/soap|rice|oil|tissue|charcoal/i);
    expect(packaged).not.toMatch(/soap|rice|oil|tissue|charcoal/i);
    expect(stock).toMatch(/soap|rice|charcoal/);
  });
});
