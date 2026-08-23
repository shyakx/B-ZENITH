import type { InventoryMovementType } from "@prisma/client";

export type MovementSlice = {
  type: InventoryMovementType | string;
  quantity: number;
};

export type InventoryTotals = {
  supplied: number;
  wasted: number;
  sold: number;
  returned: number;
  transferredOut: number;
  transferredIn: number;
  adjustments: number;
};

export const WASTE_REASONS = [
  "BREAKAGE",
  "SPOILAGE",
  "EXPIRED",
  "DAMAGED",
  "INTERNAL_USE",
  "OTHER",
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export function isWasteReason(value: string): value is WasteReason {
  return (WASTE_REASONS as readonly string[]).includes(value);
}

export function locationLabel(code: string) {
  if (code === "MAIN_STOCK") return "Main Stock";
  if (code === "BAR") return "Bar";
  if (code === "KITCHEN") return "Kitchen";
  return code;
}

export function stockStatus(total: number, reorderLevel: number) {
  if (total < 0) return "NEGATIVE";
  if (total === 0) return "ZERO";
  if (total <= reorderLevel) return "LOW";
  return "OK";
}

export type ProductMovement = MovementSlice & { productId: string };

export function groupMovementsByProduct(movements: ProductMovement[]) {
  const grouped = new Map<string, MovementSlice[]>();
  for (const movement of movements) {
    const list = grouped.get(movement.productId) ?? [];
    list.push({ type: movement.type, quantity: movement.quantity });
    grouped.set(movement.productId, list);
  }
  return grouped;
}

export function totalsByProduct(movements: ProductMovement[]) {
  const totals = new Map<string, InventoryTotals>();
  for (const [productId, slices] of groupMovementsByProduct(movements)) {
    totals.set(productId, movementTotals(slices));
  }
  return totals;
}

export function movementTotals(movements: MovementSlice[]): InventoryTotals {
  const totals: InventoryTotals = {
    supplied: 0,
    wasted: 0,
    sold: 0,
    returned: 0,
    transferredOut: 0,
    transferredIn: 0,
    adjustments: 0,
  };
  for (const movement of movements) {
    const qty = movement.quantity;
    const type = movement.type;
    if (type === "PURCHASE") totals.supplied += Math.max(0, qty);
    else if (type === "WASTE") totals.wasted += Math.abs(qty);
    else if (type === "SALE") totals.sold += Math.abs(qty);
    else if (type === "RETURN") totals.returned += Math.max(0, qty);
    else if (type === "TRANSFER_OUT") totals.transferredOut += Math.abs(qty);
    else if (type === "TRANSFER_IN") totals.transferredIn += Math.max(0, qty);
    else if (type === "ADJUSTMENT" || type === "STOCK_TAKE") totals.adjustments += qty;
  }
  return totals;
}

export function validateWasteQuantity(currentQuantity: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false as const, error: "Waste quantity must be a whole number greater than zero." };
  }
  if (currentQuantity < quantity) {
    return { ok: false as const, error: "Waste cannot take stock below zero." };
  }
  return { ok: true as const };
}

export function existingStockMigratesToMain(productStockQuantity: number) {
  return {
    MAIN_STOCK: Math.max(0, productStockQuantity),
    BAR: 0,
    KITCHEN: 0,
  };
}

