import { BusinessArea, ProductType } from "@prisma/client";

/** Staff-facing labels. Database enums stay MENU_ITEM / PACKAGED_GOOD / RAW_MATERIAL. */
export function productTypeStaffLabel(type: ProductType): string {
  switch (type) {
    case ProductType.MENU_ITEM:
      return "Prepared item";
    case ProductType.PACKAGED_GOOD:
      return "Bottled / packaged item";
    case ProductType.RAW_MATERIAL:
      return "Stock item";
  }
}

/** Contextual helper for the product type currently selected. */
export function productTypeStaffHelp(type: ProductType): string {
  switch (type) {
    case ProductType.MENU_ITEM:
      return "Prepared or served individually, such as meals and drinks.";
    case ProductType.PACKAGED_GOOD:
      return "Count bottles, cans, or packs as complete units.";
    case ProductType.RAW_MATERIAL:
      return "Ingredients and supplies such as rice, oil, charcoal, soap, tissue, and detergent.";
  }
}

/** Menu group labels for category.area (Breakfast / Drinks live under these groups). */
export function categoryAreaStaffLabel(area: BusinessArea): string {
  switch (area) {
    case BusinessArea.BAR:
      return "Bar";
    case BusinessArea.CAFE:
      return "Cafe";
    case BusinessArea.KITCHEN:
      return "Kitchen";
    case BusinessArea.OTHER:
      return "Other";
  }
}

export function categoryOptionLabel(category: { name: string; area: BusinessArea }): string {
  return `${category.name} — ${categoryAreaStaffLabel(category.area)}`;
}
