import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPath, hasNavItem, isNavItemActive, navigationForRole } from "./navigation";

function idsFor(role: string) {
  return navigationForRole(role).flatMap((section) => section.items.map((item) => item.id));
}

describe("role navigation", () => {
  it("gives OWNER dashboard, POS, inventory, catalog, and management links", () => {
    const ids = idsFor("OWNER");
    assert.ok(ids.includes("dashboard"));
    assert.ok(ids.includes("pos"));
    assert.ok(ids.includes("sales"));
    assert.ok(ids.includes("inventory-overview"));
    assert.ok(ids.includes("stock-operations"));
    assert.ok(ids.includes("suppliers"));
    assert.ok(ids.includes("menu"));
    assert.ok(ids.includes("categories"));
    assert.ok(ids.includes("expenses"));
    assert.ok(ids.includes("billiard"));
    assert.ok(ids.includes("reports"));
    assert.ok(ids.includes("staff"));
    assert.ok(ids.includes("settings"));
  });

  it("gives ADMIN the same operational destinations OWNER has", () => {
    const owner = idsFor("OWNER").slice().sort().join(",");
    const admin = idsFor("ADMIN").slice().sort().join(",");
    assert.equal(admin, owner);
  });

  it("gives MANAGER operations and inventory, not staff or settings", () => {
    const ids = idsFor("MANAGER");
    assert.ok(ids.includes("dashboard"));
    assert.ok(ids.includes("inventory-overview"));
    assert.ok(ids.includes("stock-operations"));
    assert.ok(ids.includes("suppliers"));
    assert.ok(ids.includes("menu"));
    assert.ok(ids.includes("reports"));
    assert.ok(ids.includes("expenses"));
    assert.equal(ids.includes("staff"), false);
    assert.equal(ids.includes("settings"), false);
    assert.equal(ids.includes("audit"), false);
  });

  it("keeps WAITER to POS and sales only", () => {
    const ids = idsFor("WAITER");
    assert.deepEqual(ids, ["pos", "sales"]);
    assert.equal(hasNavItem("WAITER", "inventory-overview"), false);
    assert.equal(hasNavItem("WAITER", "stock-operations"), false);
    assert.equal(hasNavItem("WAITER", "suppliers"), false);
    assert.equal(hasNavItem("WAITER", "menu"), false);
    assert.equal(hasNavItem("WAITER", "categories"), false);
    assert.equal(hasNavItem("WAITER", "staff"), false);
    assert.equal(hasNavItem("WAITER", "expenses"), false);
    assert.equal(hasNavItem("WAITER", "settings"), false);
  });

  it("does not expose Stock In as a nav destination", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "WAITER"] as const) {
      const hrefs = navigationForRole(role).flatMap((section) => section.items.map((item) => item.href));
      assert.equal(hrefs.includes("/purchases"), false);
      assert.equal(hrefs.some((href) => href.includes("stock-in")), false);
    }
  });
});

describe("active navigation states", () => {
  const overview = { id: "inventory-overview" as const, href: "/inventory", label: "Inventory Overview", roles: [] };
  const operations = { id: "stock-operations" as const, href: "/inventory/operations", label: "Stock Operations", roles: [] };
  const sales = { id: "sales" as const, href: "/sales", label: "Sales", roles: [] };
  const menu = { id: "menu" as const, href: "/menu", label: "Menu / Products", roles: [] };
  const pos = { id: "pos" as const, href: "/pos", label: "POS", roles: [] };
  const dashboard = { id: "dashboard" as const, href: "/dashboard", label: "Dashboard", roles: [] };
  const suppliers = { id: "suppliers" as const, href: "/suppliers", label: "Suppliers", roles: [] };
  const reports = { id: "reports" as const, href: "/reports", label: "Reports", roles: [] };
  const settings = { id: "settings" as const, href: "/settings", label: "Settings", roles: [] };

  it("activates Inventory Overview only on /inventory", () => {
    assert.equal(isNavItemActive("/inventory", overview), true);
    assert.equal(isNavItemActive("/inventory/operations", overview), false);
    assert.equal(isNavItemActive("/inventory/operations?tab=receive", overview), false);
  });

  it("activates Stock Operations for operations tabs and purchase routes", () => {
    assert.equal(isNavItemActive("/inventory/operations", operations), true);
    assert.equal(isNavItemActive("/inventory/operations", overview), false);
    assert.equal(isNavItemActive("/purchases", operations), true);
    assert.equal(isNavItemActive("/purchases/abc", operations), true);
    assert.equal(isNavItemActive("/inventory", operations), false);
  });

  it("activates dashboard, POS, sales, menu, suppliers, reports, and settings independently", () => {
    assert.equal(isNavItemActive("/dashboard", dashboard), true);
    assert.equal(isNavItemActive("/pos", pos), true);
    assert.equal(isNavItemActive("/sales/xyz", sales), true);
    assert.equal(isNavItemActive("/menu/prod", menu), true);
    assert.equal(isNavItemActive("/suppliers", suppliers), true);
    assert.equal(isNavItemActive("/reports", reports), true);
    assert.equal(isNavItemActive("/settings", settings), true);
    assert.equal(isNavItemActive("/inventory", dashboard), false);
  });
});

describe("server-side path authorization", () => {
  it("allows OWNER, ADMIN, and MANAGER on inventory routes", () => {
    assert.equal(canAccessPath("OWNER", "/inventory"), true);
    assert.equal(canAccessPath("ADMIN", "/inventory/operations"), true);
    assert.equal(canAccessPath("MANAGER", "/suppliers"), true);
  });

  it("blocks WAITER from inventory even if they type the URL", () => {
    assert.equal(canAccessPath("WAITER", "/inventory"), false);
    assert.equal(canAccessPath("WAITER", "/inventory/operations"), false);
    assert.equal(canAccessPath("WAITER", "/suppliers"), false);
    assert.equal(canAccessPath("WAITER", "/pos"), true);
    assert.equal(canAccessPath("WAITER", "/sales"), true);
  });
});
