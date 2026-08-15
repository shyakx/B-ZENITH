import type { Role } from "@prisma/client";

export const routeRoles: Record<string, Role[]> = {
  "/dashboard": ["OWNER", "ADMIN"],
  "/pos": ["OWNER", "ADMIN", "WAITER"],
  "/sales": ["OWNER", "ADMIN", "WAITER"],
  "/print": ["OWNER", "ADMIN", "WAITER"],
  "/menu": ["OWNER", "ADMIN", "INVENTORY"],
  "/categories": ["OWNER", "ADMIN", "INVENTORY"],
  "/inventory": ["OWNER", "ADMIN", "INVENTORY"],
  "/purchases": ["OWNER", "ADMIN", "INVENTORY"],
  "/suppliers": ["OWNER", "ADMIN", "INVENTORY"],
  "/expenses": ["OWNER", "ADMIN"],
  "/returns": ["OWNER", "ADMIN"],
  "/reports": ["OWNER", "ADMIN"],
  "/employees": ["OWNER"],
  "/audit": ["OWNER"],
  "/settings": ["OWNER", "ADMIN"],
};

export function homePath(role: Role | string) {
  if (role === "INVENTORY") return "/inventory";
  if (role === "WAITER") return "/pos";
  return "/dashboard";
}
