import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCloseBusinessDay, canCloseDay, canDeleteTransactions, canViewLifetimeSales } from "./business-day";

describe("business day close", () => {
  it("lets manager, owner, and admin close a day and view all sales", () => {
    assert.equal(canCloseBusinessDay("MANAGER"), true);
    assert.equal(canCloseBusinessDay("OWNER"), true);
    assert.equal(canCloseBusinessDay("ADMIN"), true);
    assert.equal(canViewLifetimeSales("WAITER"), false);
    assert.equal(canDeleteTransactions("ADMIN"), true);
    assert.equal(canDeleteTransactions("MANAGER"), false);
  });

  it("rejects a second close and a future day", () => {
    assert.equal(canCloseDay("2026-08-22", "2026-08-23", false).ok, true);
    assert.equal(canCloseDay("2026-08-23", "2026-08-23", true).ok, false);
    assert.equal(canCloseDay("2026-08-24", "2026-08-23", false).ok, false);
  });
});
