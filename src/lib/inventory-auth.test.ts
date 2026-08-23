import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditInventory, posOversellAllowed, waiterCanOrderWhenZero } from "./inventory-auth";

describe("inventory permissions", () => {
  it("lets OWNER, ADMIN, and MANAGER edit inventory", () => {
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
    assert.equal(posOversellAllowed("SALE"), true);
    assert.equal(posOversellAllowed("TRANSFER"), false);
    assert.equal(posOversellAllowed("WASTE"), false);
    assert.equal(posOversellAllowed("ADJUSTMENT"), false);
  });
});
