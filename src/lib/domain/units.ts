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

export function canAppearInStockOperations(product?: ProductUnitOption) {
  return Boolean(product?.baseUnit);
}

function collectUnits(product?: ProductUnitOption): UnitChoice[] {
  if (!product) return [];
  const units = new Map<string, UnitChoice>();
  if (product.baseUnit) {
    units.set(product.baseUnit.id, { ...product.baseUnit, factor: 1, isPack: false });
  }
  for (const pack of product.packs ?? []) {
    units.set(pack.unitId, { ...pack.unit, factor: pack.baseQuantity, isPack: true });
  }
  return [...units.values()];
}

export function stockInUnitsForProduct(product?: ProductUnitOption) {
  return collectUnits(product);
}

export function transferUnitsForProduct(product?: ProductUnitOption) {
  return collectUnits(product);
}

export function canReceiveProduct(product?: ProductUnitOption) {
  return stockInUnitsForProduct(product).length > 0;
}

export function preferredStockInUnitId(product?: ProductUnitOption) {
  const units = stockInUnitsForProduct(product);
  // Prefer a configured package when one exists — never invent pack sizes.
  return units.find((unit) => unit.isPack)?.id ?? units[0]?.id ?? "";
}

export function preferredTransferUnitId(product?: ProductUnitOption) {
  return product?.baseUnit?.id ?? transferUnitsForProduct(product)[0]?.id ?? "";
}

/** Units offered when transferring: whole-package products only get pack units. */
export function transferUnitChoicesForProduct(
  product?: ProductUnitOption & { wholePackageTransfer?: boolean },
) {
  const units = transferUnitsForProduct(product);
  if (product?.wholePackageTransfer) {
    const packsOnly = units.filter((unit) => unit.isPack);
    return packsOnly.length > 0 ? packsOnly : units;
  }
  return units;
}

export function preferredWholePackageTransferUnitId(
  product?: ProductUnitOption & { wholePackageTransfer?: boolean },
) {
  const choices = transferUnitChoicesForProduct(product);
  return choices.find((unit) => unit.isPack)?.id ?? choices[0]?.id ?? "";
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

const NON_PLURAL_CODES = new Set(["KG", "G", "L", "ML"]);

/** Official stock qty for inventory screens: `12 BOTTLES`, `18 KG`, `1 SHOT`. */
export function formatStockQty(quantity: number, unitCode?: string | null) {
  if (!unitCode) return String(quantity);
  const code = unitCode.trim().toUpperCase();
  if (!code) return String(quantity);
  if (NON_PLURAL_CODES.has(code)) return `${quantity} ${code}`;
  if (quantity === 1 || quantity === -1) return `${quantity} ${code}`;
  if (code === "GLASS") return `${quantity} GLASSES`;
  if (code.endsWith("S")) return `${quantity} ${code}`;
  return `${quantity} ${code}S`;
}

export function stockUnitCode(unit?: { code?: string | null; name?: string | null } | null) {
  return unit?.code?.trim().toUpperCase() || unit?.name?.trim().toUpperCase() || null;
}
