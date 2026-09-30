import { ProductType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { productTypeStaffHelp, productTypeStaffLabel } from "@/lib/product-type-labels";

describe("staff-facing product type wording", () => {
  it("does not expose database enum names to ordinary staff", () => {
    expect(productTypeStaffLabel(ProductType.MENU_ITEM)).toBe("Prepared item");
    expect(productTypeStaffLabel(ProductType.PACKAGED_GOOD)).toBe("Bottled / packaged item");
    expect(productTypeStaffLabel(ProductType.RAW_MATERIAL)).toBe("Stock item");
    expect(productTypeStaffLabel(ProductType.PACKAGED_GOOD)).not.toContain("Packaged good");
    expect(productTypeStaffLabel(ProductType.RAW_MATERIAL)).not.toContain("Raw material");
  });

  it("shows a distinct helper for each type, and the stock-item helper only for stock items", () => {
    const menu = productTypeStaffHelp(ProductType.MENU_ITEM);
    const packaged = productTypeStaffHelp(ProductType.PACKAGED_GOOD);
    const stock = productTypeStaffHelp(ProductType.RAW_MATERIAL);

    expect(menu).toBe("Prepared or served individually, such as meals and drinks.");
    expect(packaged).toBe("Count bottles, cans, or packs as complete units.");
    expect(stock).toBe(
      "Ingredients and supplies such as rice, oil, charcoal, soap, tissue, and detergent.",
    );

    expect(menu).not.toEqual(packaged);
    expect(packaged).not.toEqual(stock);
    expect(menu).not.toMatch(/soap|rice|oil|tissue|charcoal/i);
    expect(packaged).not.toMatch(/soap|rice|oil|tissue|charcoal/i);
    expect(stock).toMatch(/soap|rice|charcoal/);
  });
});
