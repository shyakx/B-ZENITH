import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canAssignRole,
  canDeleteStaffAccount,
  canManageOwnerAccount,
  isLastActiveOwner,
  lastOwnerGuardMessage,
  staffActionFlags,
} from "@/lib/auth/staff-policy";

describe("owner staff policy", () => {
  it("lets ADMIN assign every role, including OWNER", () => {
    expect(canAssignRole("OWNER", "OWNER", { activeOwnerCount: 1 })).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 1 })).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 0 })).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER", { activeOwnerCount: 1, currentRole: "WAITER" })).toBe(true);
    expect(canAssignRole("ADMIN", "WAITER", { activeOwnerCount: 1, currentRole: "OWNER" })).toBe(true);
    expect(canAssignRole("MANAGER", "OWNER", { activeOwnerCount: 0 })).toBe(false);
    expect(canAssignRole("ADMIN", "WAITER", { activeOwnerCount: 1 })).toBe(true);
    expect(assignableRoles("ADMIN", 1)).toContain("OWNER");
    expect(assignableRoles("OWNER", 1)).toContain("OWNER");
  });

  it("lets ADMIN manage OWNER accounts and blocks OWNER from deleting ADMIN", () => {
    expect(canManageOwnerAccount("ADMIN", "OWNER")).toBe(true);
    expect(canManageOwnerAccount("OWNER", "OWNER")).toBe(true);
    expect(canManageOwnerAccount("ADMIN", "WAITER")).toBe(true);
    expect(canAssignRole("OWNER", "ADMIN", { activeOwnerCount: 2, currentRole: "OWNER" })).toBe(true);
    expect(canDeleteStaffAccount("ADMIN", "OWNER")).toBe(true);
    expect(canDeleteStaffAccount("OWNER", "OWNER")).toBe(true);
    expect(canDeleteStaffAccount("OWNER", "ADMIN")).toBe(false);
    expect(canDeleteStaffAccount("ADMIN", "ADMIN")).toBe(true);
    expect(canDeleteStaffAccount("WAITER", "WAITER")).toBe(false);

    const adminOnOwner = staffActionFlags(
      { id: "admin", role: "ADMIN" },
      { id: "extra-owner", role: "OWNER", active: true },
      2,
    );
    expect(adminOnOwner.canDelete).toBe(true);
    expect(adminOnOwner.canResetPin).toBe(true);
    expect(adminOnOwner.canChangeActive).toBe(true);
    expect(adminOnOwner.assignableRoles).toContain("OWNER");

    const ownerOnAdmin = staffActionFlags(
      { id: "owner", role: "OWNER" },
      { id: "admin", role: "ADMIN", active: true },
      1,
    );
    expect(ownerOnAdmin.canDelete).toBe(false);
    expect(ownerOnAdmin.canResetPin).toBe(true);
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
    expect(flags.assignableRoles).toContain("OWNER");

    const adminOnLastOwner = staffActionFlags(
      { id: "admin", role: "ADMIN" },
      { id: "only-owner", role: "OWNER", active: true },
      1,
    );
    expect(adminOnLastOwner.canDelete).toBe(false);
    expect(adminOnLastOwner.canChangeActive).toBe(false);

    const adminFlags = staffActionFlags(
      { id: "admin", role: "ADMIN" },
      { id: "waiter", role: "WAITER", active: true },
      1,
    );
    expect(adminFlags.assignableRoles).toContain("OWNER");
  });
});
