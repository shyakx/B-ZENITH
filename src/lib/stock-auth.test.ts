import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiAuthDecision } from "./authorization";
import {
  canEditInventory,
  canViewInventory,
  showsStockMutations,
  showsStockNav,
} from "./inventory-auth";
import { canAccessPath, hasNavItem, navigationForRole } from "./navigation";
import { stockMutateRoles } from "./roles";

const STOCK_MUTATIONS = [
  { name: "Add stock", path: "/api/purchases" },
  { name: "Count stock", path: "/api/inventory/stock-take" },
  { name: "Move stock", action: "transferStock" },
  { name: "Record waste", action: "recordWaste" },
  { name: "Adjust stock", action: "adjustInventory" },
] as const;

function mutationAttempt(role: "OWNER" | "ADMIN" | "MANAGER" | "WAITER" | "BILLIARD") {
  return apiAuthDecision({ role }, stockMutateRoles);
}

describe("stock view and mutation roles", () => {
  it("lets OWNER, ADMIN, MANAGER, and WAITER view Stock", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "WAITER"] as const) {
      assert.equal(canViewInventory(role), true);
      assert.equal(showsStockNav(role), true);
    }
  });

  it("hides Stock from BILLIARD", () => {
    assert.equal(canViewInventory("BILLIARD"), false);
    assert.equal(showsStockNav("BILLIARD"), false);
    assert.equal(hasNavItem("BILLIARD", "inventory-overview"), false);
  });

  it("lets only OWNER, ADMIN, and MANAGER mutate stock", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"] as const) {
      assert.equal(canEditInventory(role), true);
      assert.equal(showsStockMutations(role), true);
    }
    assert.equal(canEditInventory("WAITER"), false);
    assert.equal(showsStockMutations("WAITER"), false);
    assert.equal(canEditInventory("BILLIARD"), false);
    assert.equal(showsStockMutations("BILLIARD"), false);
  });
});

describe("stock page route access", () => {
  it("allows OWNER, ADMIN, and MANAGER on /inventory with mutations", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"] as const) {
      assert.equal(canAccessPath(role, "/inventory"), true);
      assert.equal(canAccessPath(role, "/inventory/operations"), true);
      assert.equal(showsStockMutations(role), true);
    }
  });

  it("allows WAITER a read-only /inventory page", () => {
    assert.equal(canAccessPath("WAITER", "/inventory"), true);
    assert.equal(canAccessPath("WAITER", "/inventory/operations"), true);
    assert.equal(showsStockMutations("WAITER"), false);
    assert.ok(hasNavItem("WAITER", "inventory-overview"));
    const ids = navigationForRole("WAITER").flatMap((section) => section.items.map((item) => item.id));
    assert.ok(ids.includes("inventory-overview"));
    assert.ok(ids.includes("pos"));
  });

  it("blocks BILLIARD from /inventory even by typing the URL", () => {
    assert.equal(canAccessPath("BILLIARD", "/inventory"), false);
    assert.equal(canAccessPath("BILLIARD", "/inventory/operations"), false);
  });

  it("does not let WAITER or BILLIARD use purchases or suppliers as a write bypass", () => {
    assert.equal(canAccessPath("WAITER", "/purchases"), false);
    assert.equal(canAccessPath("WAITER", "/purchases/abc"), false);
    assert.equal(canAccessPath("WAITER", "/suppliers"), false);
    assert.equal(canAccessPath("BILLIARD", "/purchases"), false);
    assert.equal(canAccessPath("BILLIARD", "/suppliers"), false);
    assert.equal(canAccessPath("MANAGER", "/purchases"), true);
  });
});

describe("stock mutation API bypass protection", () => {
  it("allows MANAGER (and OWNER/ADMIN) through mutation auth without touching stock", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"] as const) {
      for (const operation of STOCK_MUTATIONS) {
        const result = mutationAttempt(role);
        assert.equal(result.ok, true, `${role} should be allowed to ${operation.name}`);
      }
    }
  });

  it("returns 403 when a WAITER attempts Add, Move, Count, Waste, or Adjust", () => {
    for (const operation of STOCK_MUTATIONS) {
      const result = mutationAttempt("WAITER");
      assert.equal(result.ok, false, `WAITER must be blocked from ${operation.name}`);
      if (!result.ok) {
        assert.equal(result.status, 403);
        assert.match(result.error, /permission/i);
      }
    }
  });

  it("returns 403 when a BILLIARD user attempts the same mutations", () => {
    for (const operation of STOCK_MUTATIONS) {
      const result = mutationAttempt("BILLIARD");
      assert.equal(result.ok, false, `BILLIARD must be blocked from ${operation.name}`);
      if (!result.ok) {
        assert.equal(result.status, 403);
      }
    }
  });

  it("does not treat a signed-out caller as authorized", () => {
    const result = apiAuthDecision(null, stockMutateRoles);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});
