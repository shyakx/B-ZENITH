export const ROLES = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"] as const;
export type Role = (typeof ROLES)[number];

/**
 * ADMIN has explicit all-access: every page, every permission, every staff action
 * except last-owner safety. OWNER also operates the whole business.
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
  | "viewAudit"
  | "purgeBusinessData";

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
  "purgeBusinessData",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  WAITER: ["createOrder", "viewOwnOrders", "printFacture"],
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
  ADMIN: [...PERMISSIONS],
  OWNER: [...PERMISSIONS],
};

const FULL_ACCESS_PATH_PREFIXES = ["/owner", "/waiter", "/cashier", "/manager", "/admin"] as const;

/** Admin is the explicit superuser. Owner also has full operational access. */
export function hasAllAccess(role: Role): boolean {
  return role === "ADMIN";
}

export function isFullAccessRole(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

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
  if (hasAllAccess(role)) return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * OWNER and ADMIN may enter specialist screens because both operate the whole business.
 * Other roles must match the page gate.
 */
export function satisfiesRoleGate(userRole: Role, allowed: readonly Role[]): boolean {
  if (hasAllAccess(userRole)) return true;
  return isFullAccessRole(userRole) || allowed.includes(userRole);
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const path = normalizePath(pathname);
  if (path === "/" || isPublicPath(path)) {
    return true;
  }

  if (hasAllAccess(role)) {
    return true;
  }

  if (isFullAccessRole(role)) {
    if (FULL_ACCESS_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return true;
    }
    return path.startsWith("/print/");
  }

  const prefix = ROLE_PREFIX[role];
  if (path === prefix || path.startsWith(`${prefix}/`)) {
    return true;
  }

  if (path.startsWith("/print/order/")) {
    return hasPermission(role, "printFacture");
  }

  if (path.startsWith("/print/")) {
    return role === "CASHIER" || role === "MANAGER";
  }

  return false;
}

export function canViewOrderFacture(role: Role, userId: string, orderWaiterId: string): boolean {
  if (!hasPermission(role, "printFacture")) return false;
  if (role === "WAITER") return userId === orderWaiterId;
  return true;
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
