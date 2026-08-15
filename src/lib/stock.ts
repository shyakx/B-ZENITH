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
