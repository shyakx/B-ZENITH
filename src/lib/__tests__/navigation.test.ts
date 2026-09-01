import { describe, expect, it } from "vitest";
import { groupNavItems, isNavActive, ROLE_NAV } from "@/lib/navigation";

const waiter = ROLE_NAV.WAITER.map((item) => item.href);
const cashier = ROLE_NAV.CASHIER.map((item) => item.href);

describe("route-aware navigation", () => {
  it("highlights the waiter page that matches the current path", () => {
    expect(isNavActive("/waiter", "/waiter", waiter)).toBe(true);
    expect(isNavActive("/waiter", "/waiter/orders/new", waiter)).toBe(false);
    expect(isNavActive("/waiter", "/waiter/orders", waiter)).toBe(false);

    expect(isNavActive("/waiter/orders/new", "/waiter/orders/new", waiter)).toBe(true);
    expect(isNavActive("/waiter/orders/new", "/waiter", waiter)).toBe(false);
    expect(isNavActive("/waiter/orders/new", "/waiter/orders", waiter)).toBe(false);

    expect(isNavActive("/waiter/orders", "/waiter/orders", waiter)).toBe(true);
    expect(isNavActive("/waiter/orders", "/waiter", waiter)).toBe(false);
    expect(isNavActive("/waiter/orders", "/waiter/orders/new", waiter)).toBe(false);
  });

  it("keeps the parent item active on nested routes", () => {
    expect(isNavActive("/cashier/bills/table-1", "/cashier/bills", cashier)).toBe(true);
    expect(isNavActive("/cashier/bills/table-1", "/cashier", cashier)).toBe(false);
    expect(isNavActive("/waiter/orders/", "/waiter/orders", waiter)).toBe(true);
  });

  it("keeps manager navigation short and operational", () => {
    expect(ROLE_NAV.MANAGER.map((item) => item.label)).toEqual([
      "Home",
      "Tables",
      "Products",
      "Inventory",
      "Receive Stock",
      "Orders",
      "Reports",
      "Maison",
    ]);
    expect(ROLE_NAV.MANAGER.map((item) => item.href)).toEqual([
      "/manager",
      "/manager/tables",
      "/manager/products",
      "/manager/inventory",
      "/manager/purchases",
      "/manager/orders",
      "/manager/reports",
      "/manager/maison",
    ]);
    expect(ROLE_NAV.MANAGER.map((item) => item.href)).not.toContain("/manager/sales");
    expect(ROLE_NAV.MANAGER.every((item) => item.hint.length > 0)).toBe(true);
    expect(isNavActive("/manager/tables", "/manager/tables", ROLE_NAV.MANAGER.map((item) => item.href))).toBe(true);
    expect(isNavActive("/manager/orders/abc", "/manager/orders", ROLE_NAV.MANAGER.map((item) => item.href))).toBe(
      true,
    );
    expect(isNavActive("/manager/orders/abc", "/manager", ROLE_NAV.MANAGER.map((item) => item.href))).toBe(false);
  });

  it("gives ADMIN the same business pages as OWNER plus system home", () => {
    expect(ROLE_NAV.ADMIN.map((item) => item.label)).toEqual([
      "Home",
      "Business today",
      "POS / Orders",
      "Tables",
      "Bills / Payments",
      "Outstanding",
      "Products",
      "Inventory",
      "Receive Stock",
      "Transfers",
      "Counts",
      "Adjustments",
      "Suppliers",
      "Locations",
      "Reports",
      "Maison",
      "Staff",
      "Access",
      "Settings",
      "Audit",
    ]);
    expect(ROLE_NAV.ADMIN.map((item) => item.href)).toEqual([
      "/admin",
      "/owner",
      "/waiter/orders/new",
      "/manager/tables",
      "/cashier/bills",
      "/cashier/outstanding",
      "/manager/products",
      "/manager/inventory",
      "/manager/purchases",
      "/manager/inventory/transfer",
      "/manager/inventory/count",
      "/manager/inventory/adjust",
      "/manager/inventory/suppliers",
      "/manager/inventory/locations",
      "/manager/reports",
      "/manager/maison",
      "/admin/users",
      "/admin/access",
      "/admin/settings",
      "/admin/audit",
    ]);
    expect(ROLE_NAV.OWNER.every((item) => ROLE_NAV.ADMIN.some((link) => link.href === item.href))).toBe(
      true,
    );
    const admin = ROLE_NAV.ADMIN.map((item) => item.href);
    expect(isNavActive("/admin/users/abc", "/admin/users", admin)).toBe(true);
    expect(isNavActive("/admin/users/abc", "/admin", admin)).toBe(false);
  });

  it("keeps cashier navigation to money screens only", () => {
    expect(ROLE_NAV.CASHIER.map((item) => item.label)).toEqual([
      "Home",
      "Orders / Bills",
      "Outstanding",
      "Payments",
    ]);
    expect(cashier).not.toContain("/cashier/factures");
    expect(isNavActive("/cashier/outstanding", "/cashier/outstanding", cashier)).toBe(true);
    expect(isNavActive("/cashier/outstanding", "/cashier", cashier)).toBe(false);
    expect(isNavActive("/cashier/payments", "/cashier/payments", cashier)).toBe(true);
  });

  it("groups manager and admin links without changing destinations", () => {
    expect(ROLE_NAV.WAITER.every((item) => !item.group)).toBe(true);
    expect(ROLE_NAV.CASHIER.every((item) => !item.group)).toBe(true);

    const manager = groupNavItems(ROLE_NAV.MANAGER);
    expect(manager.flatMap((group) => group.items.map((item) => item.href))).toEqual(
      ROLE_NAV.MANAGER.map((item) => item.href),
    );
    expect(manager.map((group) => group.label)).toEqual([
      "Operations",
      null,
      "Inventory",
      null,
      "Reports",
    ]);

    const admin = groupNavItems(ROLE_NAV.ADMIN);
    expect(admin.flatMap((group) => group.items.map((item) => item.href))).toEqual(
      ROLE_NAV.ADMIN.map((item) => item.href),
    );
    expect(admin.map((group) => group.label)).toEqual([
      "Business",
      "Catalog",
      "Inventory",
      "Reports",
      "Maison",
      "Administration",
    ]);
  });

  it("gives OWNER a full-business sidebar without replacing other role menus", () => {
    expect(ROLE_NAV.OWNER.map((item) => item.label)).toEqual([
      "Home",
      "POS / Orders",
      "Tables",
      "Bills / Payments",
      "Outstanding",
      "Products",
      "Inventory",
      "Receive Stock",
      "Transfers",
      "Counts",
      "Adjustments",
      "Suppliers",
      "Locations",
      "Reports",
      "Maison",
      "Staff",
      "Access",
      "Settings",
      "Audit",
    ]);
    expect(ROLE_NAV.OWNER.map((item) => item.href)).toEqual([
      "/owner",
      "/waiter/orders/new",
      "/manager/tables",
      "/cashier/bills",
      "/cashier/outstanding",
      "/manager/products",
      "/manager/inventory",
      "/manager/purchases",
      "/manager/inventory/transfer",
      "/manager/inventory/count",
      "/manager/inventory/adjust",
      "/manager/inventory/suppliers",
      "/manager/inventory/locations",
      "/manager/reports",
      "/manager/maison",
      "/admin/users",
      "/admin/access",
      "/admin/settings",
      "/admin/audit",
    ]);
    expect(ROLE_NAV.ADMIN.map((item) => item.href)).toContain("/owner");
    expect(ROLE_NAV.MANAGER.map((item) => item.href)).not.toContain("/owner");
    expect(ROLE_NAV.WAITER.map((item) => item.href)).not.toContain("/admin/users");

    const owner = groupNavItems(ROLE_NAV.OWNER);
    expect(owner.map((group) => group.label)).toEqual([
      "Business",
      "Catalog",
      "Inventory",
      "Reports",
      "Maison",
      "Administration",
    ]);
  });
});
