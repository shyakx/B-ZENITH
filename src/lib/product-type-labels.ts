import { ProductType } from "@prisma/client";

/** Staff-facing labels. Database enums stay MENU_ITEM / PACKAGED_GOOD / RAW_MATERIAL. */
export function productTypeStaffLabel(type: ProductType): string {
  switch (type) {
    case ProductType.MENU_ITEM:
      return "Menu product";
    case ProductType.PACKAGED_GOOD:
      return "Bottled / packaged for sale";
    case ProductType.RAW_MATERIAL:
      return "Stock item (not sold)";
  }
}

/** Contextual helper for the product type currently selected. */
export function productTypeStaffHelp(type: ProductType): string {
  switch (type) {
    case ProductType.MENU_ITEM:
      return "Sold on POS. Use for what customers order from the menu.";
    case ProductType.PACKAGED_GOOD:
      return "Sold on POS. The stock count is the bottle, can, or pack.";
    case ProductType.RAW_MATERIAL:
      return "Not sold on POS. Use for rice, oil, charcoal, soap, tissue, detergent, and other counted supplies.";
  }
}
