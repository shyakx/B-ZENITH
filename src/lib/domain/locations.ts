export const LOCATION_CODES = {
  MAIN: "MAIN",
  BAR: "BAR",
  KITCHEN: "KITCHEN",
  CAFE: "CAFE",
} as const;

export type LocationCode = (typeof LOCATION_CODES)[keyof typeof LOCATION_CODES];

export const WAREHOUSE_CODE = LOCATION_CODES.MAIN;
export const OPERATIONAL_CODES = [
  LOCATION_CODES.BAR,
  LOCATION_CODES.KITCHEN,
  LOCATION_CODES.CAFE,
] as const;

export type OperationalCode = (typeof OPERATIONAL_CODES)[number];

export const UNIT_CODES = {
  PIECE: "PIECE",
  BOTTLE: "BOTTLE",
  SHOT: "SHOT",
  GLASS: "GLASS",
  G: "G",
  KG: "KG",
  ML: "ML",
  L: "L",
  CRATE: "CRATE",
  CARTON: "CARTON",
  BAG: "BAG",
  BOX: "BOX",
} as const;

export function isLocationCode(value: string): value is LocationCode {
  return (Object.values(LOCATION_CODES) as string[]).includes(value);
}

export function isOperationalCode(value: string): value is OperationalCode {
  return (OPERATIONAL_CODES as readonly string[]).includes(value);
}

export function isWarehouseCode(value: string): boolean {
  return value === WAREHOUSE_CODE;
}

export function legacyStockToLocations(stockQuantity: number) {
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new Error("Legacy stock quantity cannot be negative.");
  }
  return {
    [LOCATION_CODES.MAIN]: stockQuantity,
    [LOCATION_CODES.BAR]: 0,
    [LOCATION_CODES.KITCHEN]: 0,
    [LOCATION_CODES.CAFE]: 0,
  };
}

export function compatibilityStockTotal(quantities: { quantity: number }[]) {
  return quantities.reduce((sum, row) => sum + row.quantity, 0);
}
