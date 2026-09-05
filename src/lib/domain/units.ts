const UNIT_LABELS: Record<string, string> = {
  PIECE: "Piece",
  BOTTLE: "Bottle",
  SHOT: "Shot",
  GLASS: "Glass",
  G: "Grams",
  KG: "Kg",
  ML: "Ml",
  L: "Litre",
  CRATE: "Crate",
  CARTON: "Carton",
  BAG: "Bag",
  BOX: "Box",
};

export type ProductUnitOption = {
  baseUnit?: { id: string; code: string; name: string } | null;
  packs?: { unitId: string; baseQuantity: number; unit: { id: string; code: string; name: string } }[];
};

export type UnitChoice = { id: string; code: string; name: string; factor: number; isPack: boolean };

export function unitLabel(codeOrName: string) {
  const key = codeOrName.trim().toUpperCase();
  return UNIT_LABELS[key] ?? codeOrName;
}

export function isPourUnit(codeOrName: string) {
  const key = codeOrName.trim().toUpperCase();
  return key === "SHOT" || key === "GLASS";
}

function collectUnits(product?: ProductUnitOption, stockInOnly = false): UnitChoice[] {
  if (!product) return [];
  const units = new Map<string, UnitChoice>();
  if (product.baseUnit && (!stockInOnly || !isPourUnit(product.baseUnit.code))) {
    units.set(product.baseUnit.id, { ...product.baseUnit, factor: 1, isPack: false });
  }
  for (const pack of product.packs ?? []) {
    if (stockInOnly && isPourUnit(pack.unit.code)) continue;
    units.set(pack.unitId, { ...pack.unit, factor: pack.baseQuantity, isPack: true });
  }
  return [...units.values()];
}

export function stockInUnitsForProduct(product?: ProductUnitOption) {
  return collectUnits(product, true);
}

export function transferUnitsForProduct(product?: ProductUnitOption) {
  return collectUnits(product, false);
}

export function canReceiveProduct(product?: ProductUnitOption) {
  return stockInUnitsForProduct(product).length > 0;
}

export function preferredStockInUnitId(product?: ProductUnitOption) {
  const units = stockInUnitsForProduct(product);
  return units.find((unit) => unit.code === "CRATE")?.id ?? units[0]?.id ?? "";
}

export function preferredTransferUnitId(product?: ProductUnitOption) {
  return product?.baseUnit?.id ?? transferUnitsForProduct(product)[0]?.id ?? "";
}

export function assertStockInReceiveUnit(codeOrName: string) {
  if (isPourUnit(codeOrName)) {
    throw new Error(
      "Receive full bottles or packs into Main Stock. Move shots and glasses to Bar or Kitchen from Move Stock.",
    );
  }
}

export function quantityWithUnit(quantity: number, codeOrName: string) {
  const label = unitLabel(codeOrName);
  const lower = label.toLowerCase();
  if (lower === "kg" || lower === "g" || lower === "grams" || lower === "ml" || lower === "l" || lower === "litre") {
    return `${quantity} ${label}`;
  }
  if (quantity === 1) return `1 ${lower}`;
  if (lower === "glass") return `${quantity} glasses`;
  if (lower.endsWith("s")) return `${quantity} ${lower}`;
  return `${quantity} ${lower}s`;
}
