import type { Role } from "@prisma/client";

export const dayCloseRoles: Role[] = ["ADMIN", "OWNER", "MANAGER"];
export const lifetimeSalesRoles: Role[] = ["ADMIN", "OWNER", "MANAGER"];

export function canCloseBusinessDay(role: Role | string) {
  return role === "ADMIN" || role === "OWNER" || role === "MANAGER";
}

export function canViewLifetimeSales(role: Role | string) {
  return canCloseBusinessDay(role);
}

export function canDeleteTransactions(role: Role | string) {
  return role === "ADMIN";
}

export function canCloseDay(businessDay: string, today: string, alreadyClosed: boolean) {
  if (alreadyClosed) return { ok: false as const, error: "That business day is already closed." };
  if (businessDay > today) return { ok: false as const, error: "You cannot close a future day." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDay)) return { ok: false as const, error: "Choose a valid business day." };
  return { ok: true as const };
}
