import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiAuthDecision } from "./authorization";
import { canAccessPath } from "./navigation";
import {
  canDeactivateTable,
  canManageTables,
  createTableWriteData,
  tableCanStartService,
  tableNameTaken,
  updateTableWriteData,
  validateTableName,
} from "./table-admin";

describe("table management access", () => {
  it("lets OWNER and ADMIN access Table Management", () => {
    assert.equal(canManageTables("OWNER"), true);
    assert.equal(canManageTables("ADMIN"), true);
    assert.equal(canAccessPath("OWNER", "/settings/tables"), true);
    assert.equal(canAccessPath("ADMIN", "/settings/tables"), true);
  });

  it("blocks WAITER, MANAGER, BILLIARD, and signed-out callers", () => {
    assert.equal(canManageTables("WAITER"), false);
    assert.equal(canManageTables("MANAGER"), false);
    assert.equal(canManageTables("BILLIARD"), false);
    assert.equal(canManageTables(null), false);
    assert.equal(canAccessPath("WAITER", "/settings/tables"), false);
    assert.equal(canAccessPath("MANAGER", "/settings/tables"), false);
    assert.equal(canAccessPath("BILLIARD", "/settings/tables"), false);
    assert.equal(apiAuthDecision(null, ["ADMIN", "OWNER"]).ok, false);
    assert.equal(apiAuthDecision({ role: "WAITER" }, ["ADMIN", "OWNER"]).ok, false);
    assert.equal(apiAuthDecision({ role: "MANAGER" }, ["ADMIN", "OWNER"]).ok, false);
    assert.equal(apiAuthDecision({ role: "BILLIARD" }, ["ADMIN", "OWNER"]).ok, false);
    assert.equal(apiAuthDecision({ role: "OWNER" }, ["ADMIN", "OWNER"]).ok, true);
  });
});

describe("table configuration writes", () => {
  it("creates an available active table without a service session", () => {
    const created = createTableWriteData({ name: "  T1  ", active: true, maxSortOrder: 0 });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.data, { name: "T1", active: true, status: "AVAILABLE", sortOrder: 1 });
    assert.equal("tableId" in created.data, false);
    assert.equal("waiterId" in created.data, false);
    assert.equal("sessionId" in created.data, false);
  });

  it("rejects a blank name", () => {
    assert.equal(validateTableName("   ").ok, false);
    assert.equal(createTableWriteData({ name: "\n", maxSortOrder: 2 }).ok, false);
  });

  it("rejects a duplicate name", () => {
    assert.equal(tableNameTaken("t1", ["T1", "T2"]), true);
    assert.equal(tableNameTaken("VIP 1", ["T1"]), false);
  });

  it("edits name and active flag without touching session fields", () => {
    const updated = updateTableWriteData({ name: "VIP 1", active: true });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.deepEqual(updated.data, { name: "VIP 1", active: true });
    assert.equal("status" in updated.data, false);
    assert.equal("waiterId" in updated.data, false);
  });

  it("blocks deactivation while a table is in service", () => {
    assert.equal(canDeactivateTable({ status: "OCCUPIED", openSessionCount: 0 }).ok, false);
    assert.equal(canDeactivateTable({ status: "AVAILABLE", openSessionCount: 1 }).ok, false);
    assert.equal(canDeactivateTable({ status: "AVAILABLE", openSessionCount: 0 }).ok, true);
  });

  it("does not let an inactive table start new service", () => {
    assert.equal(tableCanStartService({ active: true, status: "AVAILABLE" }), true);
    assert.equal(tableCanStartService({ active: false, status: "AVAILABLE" }), false);
    assert.equal(tableCanStartService({ active: true, status: "OCCUPIED" }), false);
    assert.equal(tableCanStartService({ active: true, status: "OUT_OF_SERVICE" }), false);
  });
});
