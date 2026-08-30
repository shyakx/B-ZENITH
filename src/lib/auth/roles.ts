export const ROLES = ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = {
  WAITER: "/waiter",
  CASHIER: "/cashier",
  MANAGER: "/manager",
  ADMIN: "/admin",
};

export const ROLE_PREFIX: Record<Role, string> = {
  WAITER: "/waiter",
  CASHIER: "/cashier",
  MANAGER: "/manager",
  ADMIN: "/admin",
};

export type Permission =
  | "createOrder"
  | "viewOwnOrders"
  | "viewAllOrders"
  | "recordPayment"
  | "payLater"
  | "printFacture"
  | "cancelOrder"
  | "manageProducts"
  | "manageInventory"
  | "viewReports"
  | "manageMaison"
  | "manageUsers"
  | "manageSettings"
  | "viewAudit";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  WAITER: ["createOrder", "viewOwnOrders"],
  CASHIER: [
    "viewAllOrders",
    "recordPayment",
    "payLater",
    "printFacture",
    "cancelOrder",
  ],
  MANAGER: [
    "viewAllOrders",
    "printFacture",
    "cancelOrder",
    "manageProducts",
    "manageInventory",
    "viewReports",
    "manageMaison",
  ],
  ADMIN: ["manageUsers", "manageSettings", "viewAudit"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/login" || path === "/lock";
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const path = normalizePath(pathname);
  if (path === "/" || isPublicPath(path)) {
    return true;
  }

  const prefix = ROLE_PREFIX[role];
  if (path === prefix || path.startsWith(`${prefix}/`)) {
    return true;
  }

  if (path.startsWith("/print/")) {
    return role === "CASHIER" || role === "MANAGER";
  }

  return false;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "WAITER":
      return "Waiter";
    case "CASHIER":
      return "Cashier";
    case "MANAGER":
      return "Manager";
    case "ADMIN":
      return "Admin";
  }
}
