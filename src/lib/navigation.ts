import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  hint: string;
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
    { href: "/waiter", label: "Home", hint: "Today's work" },
    { href: "/waiter/orders/new", label: "New Order", hint: "Take a table order" },
    { href: "/waiter/orders", label: "My Orders", hint: "Orders I opened" },
  ],
  CASHIER: [
    { href: "/cashier", label: "Home", hint: "Money today" },
    { href: "/cashier/bills", label: "Orders / Bills", hint: "Bills waiting to pay" },
    { href: "/cashier/outstanding", label: "Outstanding", hint: "Pay later and unpaid" },
    { href: "/cashier/payments", label: "Payments", hint: "Cash already taken" },
  ],
  MANAGER: [
    { href: "/manager", label: "Home", hint: "Day overview" },
    { href: "/manager/tables", label: "Tables", hint: "Open and close tables" },
    { href: "/manager/products", label: "Products", hint: "Menu and prices" },
    { href: "/manager/inventory", label: "Inventory", hint: "Stock rooms and moves" },
    { href: "/manager/purchases", label: "Receive Stock", hint: "Buy into Main Stock" },
    { href: "/manager/orders", label: "Orders", hint: "Every table order" },
    { href: "/manager/reports", label: "Reports", hint: "Sales and stock value" },
    { href: "/manager/maison", label: "Maison", hint: "Guest stay records" },
  ],
  ADMIN: [
    { href: "/admin", label: "Home", hint: "Staff overview" },
    { href: "/admin/users", label: "Staff", hint: "People, roles, PINs" },
    { href: "/admin/access", label: "Access", hint: "What each role can do" },
    { href: "/admin/settings", label: "Settings", hint: "Facture details" },
    { href: "/admin/audit", label: "Audit", hint: "Who changed what" },
  ],
};
