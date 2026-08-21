import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  ADMIN_EDIT_OWNER_MESSAGE,
  LAST_OWNER_MESSAGE,
  authorizeEmployeeUpdate,
  employeeRoleSchema,
  employeeUpdateWriteData,
} from "./employee-update";

const ownerActor = {
  actorId: "actor-owner",
  actorRole: "OWNER" as Role,
};

const adminActor = {
  actorId: "actor-admin",
  actorRole: "ADMIN" as Role,
};

function decision(
  actor: { actorId: string; actorRole: Role },
  target: { targetId: string; targetRole: Role; targetActive?: boolean },
  next: { nextRole: Role; nextActive?: boolean },
  otherActiveOwnerCount: number,
) {
  return authorizeEmployeeUpdate({
    ...actor,
    targetId: target.targetId,
    targetRole: target.targetRole,
    targetActive: target.targetActive ?? true,
    nextRole: next.nextRole,
    nextActive: next.nextActive ?? true,
    otherActiveOwnerCount,
  });
}

describe("staff role updates", () => {
  it("A. OWNER with multiple active owners: OWNER → ADMIN is allowed and write data includes ADMIN", () => {
    const auth = decision(ownerActor, { targetId: "owner-2", targetRole: "OWNER" }, { nextRole: "ADMIN" }, 1);
    assert.equal(auth.ok, true);
    const data = employeeUpdateWriteData({
      firstName: "Ada",
      lastName: "Owner",
      username: "ada.owner",
      role: "ADMIN",
      active: true,
    });
    assert.equal(data.role, "ADMIN");
  });

  it("B. OWNER with multiple active owners: OWNER → WAITER is allowed", () => {
    const auth = decision(ownerActor, { targetId: "owner-2", targetRole: "OWNER" }, { nextRole: "WAITER" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "WAITER", active: true }).role, "WAITER");
  });

  it("C. OWNER with multiple active owners: OWNER → INVENTORY is allowed", () => {
    const auth = decision(ownerActor, { targetId: "owner-2", targetRole: "OWNER" }, { nextRole: "INVENTORY" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(
      employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "INVENTORY", active: true }).role,
      "INVENTORY",
    );
  });

  it("D. last active OWNER cannot be changed to ADMIN", () => {
    const auth = decision(ownerActor, { targetId: "only-owner", targetRole: "OWNER" }, { nextRole: "ADMIN" }, 0);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, LAST_OWNER_MESSAGE);
  });

  it("E. ADMIN editing OWNER is rejected with a clear error", () => {
    const auth = decision(adminActor, { targetId: "owner-1", targetRole: "OWNER" }, { nextRole: "ADMIN" }, 2);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, ADMIN_EDIT_OWNER_MESSAGE);
  });

  it("F. ADMIN → WAITER persists in write data when authorized", () => {
    const auth = decision(adminActor, { targetId: "admin-2", targetRole: "ADMIN" }, { nextRole: "WAITER" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "WAITER", active: true }).role, "WAITER");
  });

  it("G. ADMIN → INVENTORY persists in write data when authorized", () => {
    const auth = decision(ownerActor, { targetId: "admin-2", targetRole: "ADMIN" }, { nextRole: "INVENTORY" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(
      employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "INVENTORY", active: true }).role,
      "INVENTORY",
    );
  });

  it("H. invalid role is rejected", () => {
    const parsed = employeeRoleSchema.safeParse("SUPERUSER");
    assert.equal(parsed.success, false);
    const spoofed = decision(adminActor, { targetId: "waiter-1", targetRole: "WAITER" }, { nextRole: "OWNER" }, 1);
    assert.equal(spoofed.ok, false);
  });
});
