import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  hint: string;
  group?: string;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export function groupNavItems(items: readonly NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

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
    { href: "/cashier/outstanding", label: "Outstanding", hint: "Customer credit / pay later" },
    { href: "/cashier/payments", label: "Payments", hint: "Cash already taken" },
  ],
  MANAGER: [
    { href: "/manager", label: "Home", hint: "Day overview", group: "Operations" },
    { href: "/manager/tables", label: "Tables", hint: "Open and close tables", group: "Operations" },
    { href: "/manager/products", label: "Products", hint: "Menu & stock items" },
    { href: "/manager/inventory", label: "Inventory", hint: "Stock rooms and moves", group: "Inventory" },
    { href: "/manager/purchases", label: "Receive Stock", hint: "Buy into Main Stock", group: "Inventory" },
    { href: "/manager/orders", label: "Orders", hint: "Every table order" },
    { href: "/manager/reports", label: "Reports", hint: "Sales and stock value", group: "Reports" },
    { href: "/manager/maison", label: "Maison", hint: "Guest stay records", group: "Reports" },
  ],
  ADMIN: [
    { href: "/admin", label: "Home", hint: "Staff overview", group: "Business" },
    { href: "/owner", label: "Business today", hint: "Whole business today", group: "Business" },
    { href: "/waiter", label: "Waiter home", hint: "Waiter day view", group: "Business" },
    { href: "/waiter/orders/new", label: "POS / Orders", hint: "Take a table order", group: "Business" },
    { href: "/waiter/orders", label: "Waiter orders", hint: "Orders list", group: "Business" },
    { href: "/manager", label: "Manager home", hint: "Day overview", group: "Business" },
    { href: "/manager/tables", label: "Tables", hint: "Open and close tables", group: "Business" },
    { href: "/manager/orders", label: "All orders", hint: "Every table order", group: "Business" },
    { href: "/cashier", label: "Cashier home", hint: "Money today", group: "Business" },
    { href: "/cashier/bills", label: "Bills / Payments", hint: "Bills waiting to pay", group: "Business" },
    { href: "/cashier/outstanding", label: "Outstanding", hint: "Customer credit / pay later", group: "Business" },
    { href: "/cashier/payments", label: "Payments taken", hint: "Cash already taken", group: "Business" },
    { href: "/manager/products", label: "Products", hint: "Menu & stock items", group: "Catalog" },
    { href: "/manager/inventory", label: "Inventory", hint: "Stock rooms and moves", group: "Inventory" },
    { href: "/manager/purchases", label: "Receive Stock", hint: "Buy into Main Stock", group: "Inventory" },
    { href: "/manager/inventory/transfer", label: "Transfers", hint: "Move stock between rooms", group: "Inventory" },
    { href: "/manager/inventory/count", label: "Counts", hint: "Count what is on hand", group: "Inventory" },
    { href: "/manager/inventory/adjust", label: "Adjustments", hint: "Waste and stock corrections", group: "Inventory" },
    { href: "/manager/inventory/suppliers", label: "Suppliers", hint: "Who we buy from", group: "Inventory" },
    { href: "/manager/inventory/locations", label: "Locations", hint: "Stock rooms", group: "Inventory" },
    { href: "/manager/reports", label: "Reports", hint: "Sales and stock value", group: "Reports" },
    { href: "/manager/maison", label: "Maison", hint: "Guest stay records", group: "Maison" },
    { href: "/admin/users", label: "Staff", hint: "People, roles, PINs", group: "Administration" },
    { href: "/admin/access", label: "Access", hint: "What each role can do", group: "Administration" },
    { href: "/admin/settings", label: "Settings", hint: "Facture details", group: "Administration" },
    { href: "/admin/audit", label: "Audit", hint: "Who changed what", group: "Administration" },
  ],
  OWNER: [
    { href: "/owner", label: "Home", hint: "Whole business today", group: "Business" },
    { href: "/waiter/orders/new", label: "POS / Orders", hint: "Take a table order", group: "Business" },
    { href: "/manager/tables", label: "Tables", hint: "Open and close tables", group: "Business" },
    { href: "/cashier/bills", label: "Bills / Payments", hint: "Bills waiting to pay", group: "Business" },
    { href: "/cashier/outstanding", label: "Outstanding", hint: "Customer credit / pay later", group: "Business" },
    { href: "/manager/products", label: "Products", hint: "Menu & stock items", group: "Catalog" },
    { href: "/manager/inventory", label: "Inventory", hint: "Stock rooms and moves", group: "Inventory" },
    { href: "/manager/purchases", label: "Receive Stock", hint: "Buy into Main Stock", group: "Inventory" },
    { href: "/manager/inventory/transfer", label: "Transfers", hint: "Move stock between rooms", group: "Inventory" },
    { href: "/manager/inventory/count", label: "Counts", hint: "Count what is on hand", group: "Inventory" },
    { href: "/manager/inventory/adjust", label: "Adjustments", hint: "Waste and stock corrections", group: "Inventory" },
    { href: "/manager/inventory/suppliers", label: "Suppliers", hint: "Who we buy from", group: "Inventory" },
    { href: "/manager/inventory/locations", label: "Locations", hint: "Stock rooms", group: "Inventory" },
    { href: "/manager/reports", label: "Reports", hint: "Sales and stock value", group: "Reports" },
    { href: "/manager/maison", label: "Maison", hint: "Guest stay records", group: "Maison" },
    { href: "/admin/users", label: "Staff", hint: "People, roles, PINs", group: "Administration" },
    { href: "/admin/access", label: "Access", hint: "What each role can do", group: "Administration" },
    { href: "/admin/settings", label: "Settings", hint: "Facture details", group: "Administration" },
    { href: "/admin/audit", label: "Audit", hint: "Who changed what", group: "Administration" },
  ],
};
