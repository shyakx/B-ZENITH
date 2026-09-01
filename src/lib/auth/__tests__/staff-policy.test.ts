import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canAssignRole,
  canManageOwnerAccount,
  isLastActiveOwner,
  lastOwnerGuardMessage,
  staffActionFlags,
} from "@/lib/auth/staff-policy";

describe("owner staff policy", () => {
  it("lets only OWNER assign OWNER once an owner exists", () => {
    expect(canAssignRole("OWNER", "OWNER", { activeOwnerCount: 1 })).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 1 })).toBe(false);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 1, currentRole: "WAITER" })).toBe(false);
    expect(canAssignRole("MANAGER", "OWNER", { activeOwnerCount: 0 })).toBe(false);
    expect(canAssignRole("ADMIN", "WAITER", { activeOwnerCount: 1 })).toBe(true);
    expect(assignableRoles("ADMIN", 1)).not.toContain("OWNER");
    expect(assignableRoles("OWNER", 1)).toContain("OWNER");
  });

  it("lets ADMIN create the first OWNER only, not promote existing staff", () => {
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 0 })).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 0, currentRole: "WAITER" })).toBe(false);
    expect(assignableRoles("ADMIN", 0)).toContain("OWNER");
  });

  it("blocks ADMIN from changing OWNER accounts", () => {
    expect(canManageOwnerAccount("ADMIN", "OWNER")).toBe(false);
    expect(canManageOwnerAccount("OWNER", "OWNER")).toBe(true);
    expect(canManageOwnerAccount("ADMIN", "WAITER")).toBe(true);
    expect(canAssignRole("ADMIN", "WAITER", { activeOwnerCount: 1, currentRole: "OWNER" })).toBe(false);
    expect(canAssignRole("OWNER", "ADMIN", { activeOwnerCount: 2, currentRole: "OWNER" })).toBe(true);
  });

  it("protects the last active OWNER", () => {
    expect(
      isLastActiveOwner({ role: "OWNER", active: true, activeOwnerCount: 1 }),
    ).toBe(true);
    expect(
      isLastActiveOwner({ role: "OWNER", active: true, activeOwnerCount: 2 }),
    ).toBe(false);
    expect(
      isLastActiveOwner({ role: "ADMIN", active: true, activeOwnerCount: 1 }),
    ).toBe(false);
    expect(lastOwnerGuardMessage("delete")).toMatch(/last active owner cannot be deleted/i);
    expect(lastOwnerGuardMessage("deactivate")).toMatch(/last active owner cannot be deactivated/i);

    const flags = staffActionFlags(
      { id: "actor", role: "OWNER" },
      { id: "only-owner", role: "OWNER", active: true },
      1,
    );
    expect(flags.canDelete).toBe(false);
    expect(flags.canChangeActive).toBe(false);
  });
});
