import { describe, expect, it } from "vitest";
import { auditActionLabel, auditAffected } from "@/lib/admin-audit";
import { staffControlCounts } from "@/lib/admin-control";

describe("admin system control counts", () => {
  it("summarizes staff status and role assignments", () => {
    const counts = staffControlCounts([
      { role: "OWNER", active: true },
      { role: "ADMIN", active: true },
      { role: "MANAGER", active: true },
      { role: "CASHIER", active: false },
      { role: "WAITER", active: true },
      { role: "WAITER", active: false },
    ]);

    expect(counts).toEqual({
      staff: 6,
      active: 4,
      inactive: 2,
      admins: 1,
      owners: 1,
      managers: 1,
      cashiers: 1,
      waiters: 2,
    });
  });
});

describe("admin audit labels", () => {
  it("names staff and settings actions without exposing PIN values", () => {
    expect(auditActionLabel("USER_CREATED")).toBe("Created staff");
    expect(auditActionLabel("PERMISSION_CHANGED")).toBe("Changed role");
    expect(auditActionLabel("PIN_CHANGED")).toBe("Reset PIN");
    expect(auditActionLabel("USER_ACTIVATED")).toBe("Activated staff");
    expect(auditActionLabel("USER_DEACTIVATED")).toBe("Deactivated staff");
    expect(auditActionLabel("USER_DELETED")).toBe("Deleted staff");
    expect(auditActionLabel("SETTINGS_CHANGED")).toBe("Changed settings");
    expect(auditAffected({ entity: "User", entityId: "1", after: { name: "John", role: "WAITER" } })).toBe(
      "John · WAITER",
    );
    expect(
      auditAffected({
        entity: "User",
        entityId: "1",
        before: { name: "Mary", role: "WAITER" },
        after: { name: "Mary", role: "CASHIER" },
      }),
    ).toBe("Mary · WAITER → CASHIER");
    expect(auditAffected({ entity: "Setting", entityId: "business", after: { businessName: "B-ZENITH" } })).toBe(
      "Business settings",
    );
  });
});
