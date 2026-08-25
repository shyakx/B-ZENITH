import type { Role } from "@prisma/client";
import { stockMutateRoles, stockViewRoles } from "@/lib/roles";

export const inventoryManagerRoles: Role[] = [...stockMutateRoles];

export function canViewInventory(role: Role | string) {
  return (stockViewRoles as readonly string[]).includes(role);
}

export function canEditInventory(role: Role | string) {
  return (stockMutateRoles as readonly string[]).includes(role);
}

export function canViewInventoryValue(role: Role | string) {
  return canEditInventory(role);
}

export function showsStockNav(role: Role | string) {
  return canViewInventory(role);
}

export function showsStockMutations(role: Role | string) {
  return canEditInventory(role);
}

export function waiterCanOrderWhenZero() {
  return true;
}

/** Sales, transfers, waste, and adjustments must not create negative location stock. */
export function posOversellAllowed(_operation: "SALE" | "TRANSFER" | "WASTE" | "ADJUSTMENT") {
  return false;
}

/** Legacy POST /api/sales must use the same non-negative rule as applyLocationDelta. */
export function legacySaleAllowsNegativeStock() {
  return false;
}

