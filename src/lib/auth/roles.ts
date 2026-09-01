export const ROLES = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"] as const;
export type Role = (typeof ROLES)[number];

/**
 * OWNER owns the business: full operational visibility and staff administration.
 * ADMIN is staff-control only (people, PINs, settings, audit) and is not a floor operator.
 * MANAGER runs catalog, inventory, reports, and Maison — not payments or staff.
 * CASHIER takes payments. WAITER takes orders.
 */
export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/owner",
  ADMIN: "/admin",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  WAITER: "/waiter",
};

export const ROLE_PREFIX: Record<Role, string> = {
  OWNER: "/owner",
  ADMIN: "/admin",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  WAITER: "/waiter",
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

export const PERMISSIONS: Permission[] = [
  "createOrder",
  "viewOwnOrders",
  "viewAllOrders",
  "recordPayment",
  "payLater",
  "printFacture",
  "cancelOrder",
  "manageProducts",
  "manageInventory",
  "viewReports",
  "manageMaison",
  "manageUsers",
  "manageSettings",
  "viewAudit",
];

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
  OWNER: [...PERMISSIONS],
};

const OWNER_PATH_PREFIXES = ["/owner", "/waiter", "/cashier", "/manager", "/admin"] as const;

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
  return path === "/login" || path === "/lock" || path === "/manifest.webmanifest";
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * OWNER may enter specialist screens because the owner operates the whole business.
 * Other roles must match the page gate. ADMIN still cannot open waiter/cashier/manager
 * URLs — that stays in canAccessPath.
 */
export function satisfiesRoleGate(userRole: Role, allowed: readonly Role[]): boolean {
  return userRole === "OWNER" || allowed.includes(userRole);
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const path = normalizePath(pathname);
  if (path === "/" || isPublicPath(path)) {
    return true;
  }

  if (role === "OWNER") {
    if (OWNER_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return true;
    }
    return path.startsWith("/print/");
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
    case "OWNER":
      return "Owner";
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
