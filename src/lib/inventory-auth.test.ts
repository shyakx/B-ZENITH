import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditInventory, canViewInventory, posOversellAllowed, waiterCanOrderWhenZero } from "./inventory-auth";

describe("inventory permissions", () => {
  it("lets OWNER, ADMIN, MANAGER, and WAITER view inventory, but only managers edit", () => {
    assert.equal(canViewInventory("OWNER"), true);
    assert.equal(canViewInventory("ADMIN"), true);
    assert.equal(canViewInventory("MANAGER"), true);
    assert.equal(canViewInventory("WAITER"), true);
    assert.equal(canViewInventory("BILLIARD"), false);
    assert.equal(canEditInventory("OWNER"), true);
    assert.equal(canEditInventory("ADMIN"), true);
    assert.equal(canEditInventory("MANAGER"), true);
  });

  it("blocks WAITER and BILLIARD from inventory edits", () => {
    assert.equal(canEditInventory("WAITER"), false);
    assert.equal(canEditInventory("BILLIARD"), false);
  });

  it("lets a waiter sell when available quantity is 0", () => {
    assert.equal(waiterCanOrderWhenZero(), true);
    assert.equal(posOversellAllowed("SALE"), false);
    assert.equal(posOversellAllowed("TRANSFER"), false);
    assert.equal(posOversellAllowed("WASTE"), false);
    assert.equal(posOversellAllowed("ADJUSTMENT"), false);
  });
});
