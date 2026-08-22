import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  DELETE_SELF_MESSAGE,
  LAST_OWNER_MESSAGE,
  OWNER_DELETE_OWNER_MESSAGE,
  authorizeEmployeeDelete,
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

function deleteDecision(
  actor: { actorId: string; actorRole: Role },
  target: { targetId: string; targetRole: Role; targetActive?: boolean },
  otherActiveOwnerCount: number,
) {
  return authorizeEmployeeDelete({
    ...actor,
    targetId: target.targetId,
    targetRole: target.targetRole,
    targetActive: target.targetActive ?? true,
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

  it("C. OWNER with multiple active owners: OWNER → MANAGER is allowed", () => {
    const auth = decision(ownerActor, { targetId: "owner-2", targetRole: "OWNER" }, { nextRole: "MANAGER" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(
      employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "MANAGER", active: true }).role,
      "MANAGER",
    );
  });

  it("D. last active OWNER cannot be changed to ADMIN", () => {
    const auth = decision(ownerActor, { targetId: "only-owner", targetRole: "OWNER" }, { nextRole: "ADMIN" }, 0);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, LAST_OWNER_MESSAGE);
  });

  it("E. ADMIN can edit an OWNER account when another owner exists", () => {
    const auth = decision(adminActor, { targetId: "owner-1", targetRole: "OWNER" }, { nextRole: "ADMIN" }, 2);
    assert.equal(auth.ok, true);
  });

  it("F. ADMIN → WAITER persists in write data when authorized", () => {
    const auth = decision(adminActor, { targetId: "admin-2", targetRole: "ADMIN" }, { nextRole: "WAITER" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "WAITER", active: true }).role, "WAITER");
  });

  it("G. ADMIN → MANAGER persists in write data when authorized", () => {
    const auth = decision(ownerActor, { targetId: "admin-2", targetRole: "ADMIN" }, { nextRole: "MANAGER" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(
      employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "MANAGER", active: true }).role,
      "MANAGER",
    );
  });

  it("H. ADMIN can promote WAITER → OWNER", () => {
    const parsed = employeeRoleSchema.safeParse("SUPERUSER");
    assert.equal(parsed.success, false);
    const promoted = decision(adminActor, { targetId: "waiter-1", targetRole: "WAITER" }, { nextRole: "OWNER" }, 1);
    assert.equal(promoted.ok, true);
  });
});

describe("staff deletes", () => {
  it("ADMIN can delete an OWNER when another owner exists", () => {
    const auth = deleteDecision(adminActor, { targetId: "owner-1", targetRole: "OWNER" }, 1);
    assert.equal(auth.ok, true);
  });

  it("ADMIN cannot delete the last active OWNER", () => {
    const auth = deleteDecision(adminActor, { targetId: "only-owner", targetRole: "OWNER" }, 0);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, LAST_OWNER_MESSAGE);
  });

  it("cannot delete your own account", () => {
    const auth = deleteDecision(adminActor, { targetId: "actor-admin", targetRole: "ADMIN" }, 1);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, DELETE_SELF_MESSAGE);
  });

  it("OWNER cannot delete an OWNER account", () => {
    const auth = deleteDecision(ownerActor, { targetId: "owner-2", targetRole: "OWNER" }, 1);
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.error, OWNER_DELETE_OWNER_MESSAGE);
  });

  it("OWNER can assign BILLIARD operators", () => {
    const auth = decision(ownerActor, { targetId: "new-1", targetRole: "WAITER" }, { nextRole: "BILLIARD" }, 1);
    assert.equal(auth.ok, true);
    assert.equal(
      employeeUpdateWriteData({ firstName: "A", lastName: "B", username: "ab", role: "BILLIARD", active: true }).role,
      "BILLIARD",
    );
  });

  it("OWNER can delete a WAITER", () => {
    const auth = deleteDecision(ownerActor, { targetId: "waiter-1", targetRole: "WAITER" }, 1);
    assert.equal(auth.ok, true);
  });
});
