import { describe, expect, it } from "vitest";
import { isLiveStaffAccount } from "@/lib/auth/staff-account";

describe("live staff session gate", () => {
  it("allows only active, non-deleted accounts with a known role", () => {
    expect(isLiveStaffAccount({ active: true, deletedAt: null, role: "WAITER" })).toBe(true);
    expect(isLiveStaffAccount({ active: true, deletedAt: null, role: "OWNER" })).toBe(true);
    expect(isLiveStaffAccount({ active: false, deletedAt: null, role: "WAITER" })).toBe(false);
    expect(isLiveStaffAccount({ active: true, deletedAt: new Date(), role: "WAITER" })).toBe(false);
    expect(isLiveStaffAccount({ active: false, deletedAt: new Date(), role: "OWNER" })).toBe(false);
    expect(isLiveStaffAccount({ active: true, deletedAt: null, role: "BILLIARD" })).toBe(false);
    expect(isLiveStaffAccount(null)).toBe(false);
  });
});
