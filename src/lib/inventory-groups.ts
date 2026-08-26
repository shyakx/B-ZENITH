import type { ProductUnit } from "@prisma/client";

export type InventoryGroupId =
  | "BAR_DRINKS"
  | "BAR_OTHER"
  | "KITCHEN_FOOD"
  | "KITCHEN_OTHER"
  | "UNASSIGNED";

export const INVENTORY_GROUPS: Array<{
  id: InventoryGroupId;
  title: string;
  hint: string;
  tone: string;
}> = [
  {
    id: "BAR_DRINKS",
    title: "Bar — drinks",
    hint: "Sold from the bar. Main Stock holds unopened drinks until a transfer to Bar.",
    tone: "border-black bg-white",
  },
  {
    id: "BAR_OTHER",
    title: "Bar — other items",
    hint: "Bar-sold items that are not bottled or canned drinks.",
    tone: "border-black bg-white",
  },
  {
    id: "KITCHEN_FOOD",
    title: "Kitchen — food",
    hint: "Sold from the kitchen. Main Stock holds food supplies until a transfer to Kitchen.",
    tone: "border-black bg-white",
  },
  {
    id: "KITCHEN_OTHER",
    title: "Kitchen — other items",
    hint: "Kitchen-sold items that are not plates, portions, or bulk food.",
    tone: "border-black bg-white",
  },
  {
    id: "UNASSIGNED",
    title: "Needs a selling location",
    hint: "Set Bar or Kitchen on the menu item so stock belongs to the right operation.",
    tone: "border-black bg-white",
  },
];

export function isDrinkUnit(unit: ProductUnit) {
  return unit === "BOTTLE" || unit === "CAN" || unit === "GLASS" || unit === "SHOT";
}

export function isFoodUnit(unit: ProductUnit) {
  return unit === "PLATE" || unit === "PORTION" || unit === "KG";
}

export function inventoryGroupId(product: {
  sellingLocationCode?: string | null;
  unit: ProductUnit;
}): InventoryGroupId {
  const location = product.sellingLocationCode;
  if (location === "BAR") return isDrinkUnit(product.unit) ? "BAR_DRINKS" : "BAR_OTHER";
  if (location === "KITCHEN") return isFoodUnit(product.unit) ? "KITCHEN_FOOD" : "KITCHEN_OTHER";
  if (isDrinkUnit(product.unit)) return "BAR_DRINKS";
  if (isFoodUnit(product.unit)) return "KITCHEN_FOOD";
  return "UNASSIGNED";
}

export type StockDestination = "BAR" | "KITCHEN" | "UNASSIGNED";

export const DESTINATION_SECTIONS: Array<{
  id: StockDestination;
  title: string;
  hint: string;
}> = [
  {
    id: "BAR",
    title: "Held in Stock · for Bar",
    hint: "Received from suppliers into Main Stock. A manager sends this to Bar when the bar needs it.",
  },
  {
    id: "KITCHEN",
    title: "Held in Stock · for Kitchen",
    hint: "Received from suppliers into Main Stock. A manager sends this to Kitchen when the kitchen needs it.",
  },
  {
    id: "UNASSIGNED",
    title: "Held in Stock · set destination",
    hint: "Still in Main Stock. Set Bar or Kitchen on the item so staff know where it should go.",
  },
];

export function stockDestination(product: {
  sellingLocationCode?: string | null;
  unit: ProductUnit;
}): StockDestination {
  const group = inventoryGroupId(product);
  if (group === "BAR_DRINKS" || group === "BAR_OTHER") return "BAR";
  if (group === "KITCHEN_FOOD" || group === "KITCHEN_OTHER") return "KITCHEN";
  return "UNASSIGNED";
}
