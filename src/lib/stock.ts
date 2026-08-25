import type { ProductUnit } from "@prisma/client";

/** Sealed physical units that should move inventory 1:1. Shots and glasses are pours, not bottle deductions. */
export function deductsPhysicalStock(unit: ProductUnit) {
  return unit === "BOTTLE" || unit === "CAN";
}

export const TRACKED_CATEGORY_NAMES = ["Drinks"] as const;

export const RECOMMENDED_TRACKED_LATER = [
  "Spirits",
  "Red Wine",
  "White Wine",
  "Champagne",
] as const;

const PHYSICAL_UNITS = new Set(["BOTTLE", "CAN", "KG", "PIECE"]);
const MENU_UNITS = new Set(["PORTION", "PLATE", "GLASS", "SHOT"]);

export const STOCK_TYPE_FILTERS = [
  "ALL",
  "KITCHEN",
  "BAR",
  "CAFE",
  "PACKAGING",
  "INGREDIENTS",
  "DRINKS",
] as const;

export type StockTypeFilter = (typeof STOCK_TYPE_FILTERS)[number];
export type CatalogKindFilter = "STOCK" | "MENU" | "ALL";

const TYPE_CATEGORIES: Record<Exclude<StockTypeFilter, "ALL">, string[]> = {
  KITCHEN: [
    "Vegetables",
    "Fruits",
    "Meat",
    "Poultry",
    "Fish & Seafood",
    "Dry Goods",
    "Flour & Baking",
    "Oils",
    "Sauces & Condiments",
    "Spices & Seasoning",
    "Dairy",
    "Eggs",
  ],
  BAR: [
    "Drinks",
    "Spirits",
    "Mixers",
    "Cocktail Ingredients",
    "Red Wine",
    "White Wine",
    "Champagne",
  ],
  CAFE: ["Café Ingredients", "Coffee", "Tea", "Iced Drinks"],
  PACKAGING: ["Packaging & Consumables"],
  INGREDIENTS: [
    "Vegetables",
    "Fruits",
    "Meat",
    "Poultry",
    "Fish & Seafood",
    "Dry Goods",
    "Flour & Baking",
    "Oils",
    "Sauces & Condiments",
    "Spices & Seasoning",
    "Dairy",
    "Eggs",
    "Café Ingredients",
    "Cocktail Ingredients",
  ],
  DRINKS: ["Drinks", "Mixers", "Spirits", "Red Wine", "White Wine", "Champagne"],
};

export function isReceivableDrink(unit: ProductUnit, categoryName?: string | null) {
  if (deductsPhysicalStock(unit)) return true;
  return Boolean(categoryName && (TRACKED_CATEGORY_NAMES as readonly string[]).includes(categoryName));
}

/**
 * Physical catalog items staff can manage on the Stock page.
 * Does not use trackInventory or a drinks-only category/unit filter.
 */
export function isStockPageProduct(product: {
  unit?: ProductUnit | string;
  sku?: string;
}) {
  if (product.sku?.startsWith("__del__.")) return false;
  if (product.unit === "OTHER") return false;
  return true;
}

export function isPhysicalStockProduct(product: {
  unit?: ProductUnit | string;
  sku?: string;
  seedKey?: string | null;
}) {
  if (!isStockPageProduct(product)) return false;
  if (product.seedKey?.startsWith("physical-stock::")) return true;
  return PHYSICAL_UNITS.has(String(product.unit ?? ""));
}

export function isMenuCatalogProduct(product: {
  unit?: ProductUnit | string;
  sku?: string;
  seedKey?: string | null;
}) {
  if (!isStockPageProduct(product)) return false;
  if (isPhysicalStockProduct(product)) return false;
  return MENU_UNITS.has(String(product.unit ?? ""));
}

export function matchesCatalogKind(
  product: { unit?: ProductUnit | string; sku?: string; seedKey?: string | null },
  kind: CatalogKindFilter,
) {
  if (kind === "ALL") return isStockPageProduct(product);
  if (kind === "STOCK") return isPhysicalStockProduct(product);
  return isMenuCatalogProduct(product);
}

export function matchesStockType(categoryName: string, type: StockTypeFilter) {
  if (type === "ALL") return true;
  return TYPE_CATEGORIES[type].includes(categoryName);
}

/** Human-readable unit for a quantity. */
export function formatUnit(unit: string, quantity = 1) {
  if (unit === "KG") return "KG";
  if (unit === "PIECE") return "PCS";
  if (unit === "BOTTLE") return quantity === 1 ? "bottle" : "bottles";
  if (unit === "CAN") return quantity === 1 ? "can" : "cans";
  if (unit === "PORTION") return quantity === 1 ? "portion" : "portions";
  if (unit === "PLATE") return quantity === 1 ? "plate" : "plates";
  if (unit === "GLASS") return quantity === 1 ? "glass" : "glasses";
  if (unit === "SHOT") return quantity === 1 ? "shot" : "shots";
  return unit.toLowerCase();
}

export function formatQuantity(quantity: number, unit: string) {
  return `${quantity} ${formatUnit(unit, quantity)}`;
}

/** Add Stock and other stock operations: physical stock only, not menu dishes. */
export function isAddStockItem(product: {
  unit?: ProductUnit | string;
  sku?: string;
  trackInventory?: boolean;
  categoryName?: string | null;
  seedKey?: string | null;
}) {
  return isPhysicalStockProduct(product);
}
