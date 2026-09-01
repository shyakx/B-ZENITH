import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
};

function normalizeNavPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
}

export function isNavActive(pathname: string, href: string, items: readonly string[]): boolean {
  const path = normalizeNavPath(pathname);
  const target = normalizeNavPath(href);
  const match = items
    .map(normalizeNavPath)
    .filter((item) => path === item || path.startsWith(`${item}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match === target;
}

export const ROLE_NAV: Record<Role, NavItem[]> = {
  WAITER: [
    { href: "/waiter", label: "Home" },
    { href: "/waiter/orders/new", label: "New Order" },
    { href: "/waiter/orders", label: "My Orders" },
  ],
  CASHIER: [
    { href: "/cashier", label: "Home" },
    { href: "/cashier/bills", label: "Orders / Bills" },
    { href: "/cashier/outstanding", label: "Outstanding" },
    { href: "/cashier/payments", label: "Payments" },
  ],
  MANAGER: [
    { href: "/manager", label: "Home" },
    { href: "/manager/tables", label: "Tables" },
    { href: "/manager/products", label: "Products" },
    { href: "/manager/inventory", label: "Inventory" },
    { href: "/manager/purchases", label: "Receive Stock" },
    { href: "/manager/orders", label: "Orders" },
    { href: "/manager/reports", label: "Reports" },
    { href: "/manager/maison", label: "Maison de Passage" },
  ],
  ADMIN: [
    { href: "/admin", label: "Home" },
    { href: "/admin/users", label: "Staff" },
    { href: "/admin/access", label: "Access" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/audit", label: "Audit" },
  ],
};
