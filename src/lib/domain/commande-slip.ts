import { BusinessArea, ProductType } from "@prisma/client";

export type CommandeStation = "KITCHEN" | "BAR_CAFE";

export function commandeStationForProduct(input: {
  categoryArea: BusinessArea;
  productType?: ProductType;
  defaultStockLocationCode?: string | null;
}): CommandeStation {
  if (input.categoryArea === BusinessArea.KITCHEN) return "KITCHEN";
  if (input.categoryArea === BusinessArea.BAR || input.categoryArea === BusinessArea.CAFE) {
    return "BAR_CAFE";
  }
  if (
    input.productType === ProductType.RAW_MATERIAL ||
    input.defaultStockLocationCode === "KITCHEN"
  ) {
    return "KITCHEN";
  }
  return "BAR_CAFE";
}

export function commandeStationLabel(station: CommandeStation) {
  return station === "KITCHEN" ? "Kitchen" : "Bar / Cafe";
}

export function splitItemsByCommandeStation<T extends { productId: string }>(
  items: T[],
  stationByProductId: Map<string, CommandeStation>,
): { station: CommandeStation; items: T[] }[] {
  const kitchen = items.filter((item) => stationByProductId.get(item.productId) === "KITCHEN");
  const barCafe = items.filter((item) => stationByProductId.get(item.productId) !== "KITCHEN");
  const slips: { station: CommandeStation; items: T[] }[] = [];
  if (kitchen.length > 0) slips.push({ station: "KITCHEN", items: kitchen });
  if (barCafe.length > 0) slips.push({ station: "BAR_CAFE", items: barCafe });
  return slips;
}
