import type { Role } from "@prisma/client";

export const inventoryManagerRoles: Role[] = ["ADMIN", "OWNER", "MANAGER"];

export function canEditInventory(role: Role | string) {
  return role === "ADMIN" || role === "OWNER" || role === "MANAGER";
}

export function canViewInventoryValue(role: Role | string) {
  return canEditInventory(role);
}

export function waiterCanOrderWhenZero() {
  return true;
}

export function posOversellAllowed(operation: "SALE" | "TRANSFER" | "WASTE" | "ADJUSTMENT") {
  return operation === "SALE";
}

