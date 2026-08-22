import type { Role } from "@prisma/client";
import { businessRoles, catalogRoles, tillRoles, userAdminRoles } from "@/lib/roles";

export const routeRoles: Record<string, readonly Role[]> = {
  "/dashboard": businessRoles,
  "/pos": tillRoles,
  "/sales": tillRoles,
  "/print": tillRoles,
  "/menu": catalogRoles,
  "/categories": catalogRoles,
  "/inventory": catalogRoles,
  "/purchases": catalogRoles,
  "/suppliers": catalogRoles,
  "/expenses": businessRoles,
  "/returns": businessRoles,
  "/reports": businessRoles,
  "/employees": userAdminRoles,
  "/audit": userAdminRoles,
  "/settings": userAdminRoles,
};

export function homePath(role: Role | string) {
  if (role === "WAITER") return "/pos";
  return "/dashboard";
}
