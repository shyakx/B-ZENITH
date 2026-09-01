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

export function unitLabel(codeOrName: string) {
  const key = codeOrName.trim().toUpperCase();
  return UNIT_LABELS[key] ?? codeOrName;
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
