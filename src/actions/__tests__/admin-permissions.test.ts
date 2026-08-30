import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { changePinAction, createUserAction, updateUserAction } from "@/actions/users";
import { saveSettingsAction } from "@/actions/settings";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import { getBusinessSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

loadEnvConfig(process.cwd());

const { testActor } = vi.hoisted(() => ({
  testActor: { id: "", name: "Test", role: "WAITER" as Role },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: async (permission: Permission) => {
    if (!hasPermission(testActor.role, permission)) {
      throw new AppError("You are not allowed to do this.", "FORBIDDEN");
    }
    return testActor;
  },
}));

const createdUserIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Seed data is required for this test (an active Admin).");
  testActor.id = admin.id;
  testActor.name = admin.name;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityId: { in: createdUserIds } }, { userId: { in: createdUserIds } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("admin action permission gates", () => {
  it("blocks waiter, cashier, and manager from staff and settings actions", async () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER"] as const) {
      testActor.role = role;
      const created = await createUserAction({ name: "Blocked", role: "WAITER", pin: "1234" });
      expect(created.ok).toBe(false);
      if (!created.ok) expect(created.error).toBe("You are not allowed to do this.");

      const updated = await updateUserAction({
        id: testActor.id,
        name: "Blocked",
        role: "WAITER",
        active: true,
      });
      expect(updated.ok).toBe(false);

      const pin = await changePinAction({ id: testActor.id, pin: "1234" });
      expect(pin.ok).toBe(false);

      const settings = await saveSettingsAction(await getBusinessSettings());
      expect(settings.ok).toBe(false);
    }
  });

  it("lets an admin create staff and save settings, and audits the settings change", async () => {
    testActor.role = "ADMIN";
    const created = await createUserAction({
      name: `Admin Action ${Date.now()}`,
      role: "WAITER",
      pin: "7777",
    });
    expect(created.ok).toBe(true);
    if (created.ok) createdUserIds.push(created.data.id);

    if (created.ok) {
      expect(JSON.stringify(created.data)).not.toMatch(/7777/);
    }

    const current = await getBusinessSettings();
    const saved = await saveSettingsAction(current);
    expect(saved.ok).toBe(true);

    const settingsAudit = await prisma.auditLog.findFirst({
      where: { action: "SETTINGS_CHANGED", userId: testActor.id },
      orderBy: { createdAt: "desc" },
    });
    expect(settingsAudit).toBeTruthy();
    expect(JSON.stringify(settingsAudit)).not.toMatch(/7777/);
  });
});
