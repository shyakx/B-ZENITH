import type { Role } from "@prisma/client";
import { routeRoles } from "@/lib/permissions";
import { billiardRoles, businessRoles, catalogRoles, tillRoles, userAdminRoles } from "@/lib/roles";

export type NavItemId =
  | "dashboard"
  | "pos"
  | "sales"
  | "inventory-overview"
  | "stock-operations"
  | "suppliers"
  | "menu"
  | "categories"
  | "expenses"
  | "returns"
  | "billiard"
  | "reports"
  | "staff"
  | "audit"
  | "settings";

export type NavItem = {
  id: NavItemId;
  href: string;
  label: string;
  roles: readonly Role[];
};

export type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const allNavItems: NavItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", roles: businessRoles },
  { id: "pos", href: "/pos", label: "POS", roles: tillRoles },
  { id: "sales", href: "/sales", label: "Sales", roles: tillRoles },
  { id: "inventory-overview", href: "/inventory", label: "Inventory Overview", roles: catalogRoles },
  { id: "stock-operations", href: "/inventory/operations", label: "Stock Operations", roles: catalogRoles },
  { id: "suppliers", href: "/suppliers", label: "Suppliers", roles: catalogRoles },
  { id: "menu", href: "/menu", label: "Menu / Products", roles: catalogRoles },
  { id: "categories", href: "/categories", label: "Categories", roles: catalogRoles },
  { id: "expenses", href: "/expenses", label: "Expenses", roles: businessRoles },
  { id: "returns", href: "/returns", label: "Returns", roles: businessRoles },
  { id: "billiard", href: "/billiard", label: "Billiard", roles: billiardRoles },
  { id: "reports", href: "/reports", label: "Reports", roles: businessRoles },
  { id: "staff", href: "/employees", label: "Staff", roles: userAdminRoles },
  { id: "audit", href: "/audit", label: "Audit logs", roles: userAdminRoles },
  { id: "settings", href: "/settings", label: "Settings", roles: userAdminRoles },
];

const sectionOrder: Array<{ id: string; title: string; itemIds: NavItemId[] }> = [
  { id: "main", title: "Main", itemIds: ["dashboard", "pos"] },
  { id: "operations", title: "Operations", itemIds: ["sales", "expenses", "returns", "billiard"] },
  { id: "inventory", title: "Inventory", itemIds: ["inventory-overview", "stock-operations", "suppliers"] },
  { id: "catalog", title: "Catalog", itemIds: ["menu", "categories"] },
  { id: "management", title: "Management", itemIds: ["staff", "reports", "audit", "settings"] },
];

export function canAccessPath(role: Role | string, pathname: string) {
  const entry = Object.entries(routeRoles).find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  if (!entry) return true;
  return entry[1].some((allowed) => allowed === role);
}

export function navLabelForRole(item: NavItem, role: Role | string) {
  if (item.id === "sales" && role === "WAITER") return "My Sales";
  return item.label;
}

export function isNavItemActive(pathname: string, item: NavItem) {
  if (item.id === "inventory-overview") {
    return pathname === "/inventory";
  }
  if (item.id === "stock-operations") {
    return (
      pathname === "/inventory/operations" ||
      pathname.startsWith("/inventory/operations/") ||
      pathname === "/purchases" ||
      pathname.startsWith("/purchases/")
    );
  }
  if (item.id === "pos") return pathname === "/pos" || pathname.startsWith("/pos/");
  if (item.id === "dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (item.id === "sales") return pathname === "/sales" || pathname.startsWith("/sales/");
  if (item.id === "menu") return pathname === "/menu" || pathname.startsWith("/menu/");
  if (item.id === "categories") return pathname === "/categories" || pathname.startsWith("/categories/");
  if (item.id === "suppliers") return pathname === "/suppliers" || pathname.startsWith("/suppliers/");
  if (item.id === "expenses") return pathname === "/expenses" || pathname.startsWith("/expenses/");
  if (item.id === "returns") return pathname === "/returns" || pathname.startsWith("/returns/");
  if (item.id === "billiard") return pathname === "/billiard" || pathname.startsWith("/billiard/");
  if (item.id === "reports") return pathname === "/reports" || pathname.startsWith("/reports/");
  if (item.id === "staff") return pathname === "/employees" || pathname.startsWith("/employees/");
  if (item.id === "audit") return pathname === "/audit" || pathname.startsWith("/audit/");
  if (item.id === "settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function navigationForRole(role: Role | string): NavSection[] {
  const allowed = allNavItems.filter((item) => item.roles.some((allowedRole) => allowedRole === role));
  if (role === "WAITER") {
    return [
      {
        id: "main",
        title: "Main",
        items: allowed.filter((item) => item.id === "pos" || item.id === "sales"),
      },
    ].filter((section) => section.items.length > 0);
  }
  return sectionOrder
    .map((section) => ({
      id: section.id,
      title: section.title,
      items: section.itemIds
        .map((id) => allowed.find((item) => item.id === id))
        .filter((item): item is NavItem => Boolean(item)),
    }))
    .filter((section) => section.items.length > 0);
}

export function hasNavItem(role: Role | string, id: NavItemId) {
  return navigationForRole(role).some((section) => section.items.some((item) => item.id === id));
}
