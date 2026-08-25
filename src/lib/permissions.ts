import type { Role } from "@prisma/client";
import { billiardRoles, businessRoles, catalogRoles, stockViewRoles, tillRoles, userAdminRoles } from "@/lib/roles";

export const routeRoles: Record<string, readonly Role[]> = {
  "/dashboard": businessRoles,
  "/pos": tillRoles,
  "/sales": tillRoles,
  "/fulfillment": tillRoles,
  "/print": tillRoles,
  "/menu": catalogRoles,
  "/categories": catalogRoles,
  "/inventory": stockViewRoles,
  "/purchases": catalogRoles,
  "/suppliers": catalogRoles,
  "/expenses": businessRoles,
  "/returns": businessRoles,
  "/reports": businessRoles,
  "/billiard": billiardRoles,
  "/employees": userAdminRoles,
  "/audit": userAdminRoles,
  "/settings": userAdminRoles,
};

export function homePath(role: Role | string) {
  if (role === "WAITER") return "/pos";
  if (role === "BILLIARD") return "/billiard";
  return "/dashboard";
}
