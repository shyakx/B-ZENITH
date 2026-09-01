import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";
import { verifyPin } from "@/lib/auth/pin";
import { prisma } from "@/lib/prisma";
import { changePin, createUser, listStaffForLogin, updateUser } from "@/services/users";

loadEnvConfig(process.cwd());

const createdUserIds: string[] = [];

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

async function adminActor() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Seed data is required for this test (an active Admin).");
  return admin;
}

describe("admin staff management against the database", () => {
  it("creates staff, rejects invalid records, and never returns a PIN", async () => {
    const admin = await adminActor();

    await expect(
      createUser({ name: " ", role: "WAITER", pin: "1234", actorId: admin.id }),
    ).rejects.toThrow("Staff name is required.");
    await expect(
      createUser({ name: "Amina", role: "KITCHEN", pin: "1234", actorId: admin.id }),
    ).rejects.toThrow("Choose a valid role.");
    await expect(
      createUser({ name: "Amina", role: "WAITER", pin: "12", actorId: admin.id }),
    ).rejects.toThrow("PIN must be 4 to 6 digits.");

    const created = await createUser({
      name: `Admin Test ${Date.now()}`,
      role: "WAITER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(created.id);

    expect(created).toMatchObject({ role: "WAITER", active: true });
    expect(created).not.toHaveProperty("pinHash");
    expect(JSON.stringify(created)).not.toMatch(/5555/);

    const row = await prisma.user.findUnique({ where: { id: created.id } });
    expect(row).toBeTruthy();
    expect(await verifyPin("5555", row!.pinHash)).toBe(true);

    const createdAudit = await prisma.auditLog.findFirst({
      where: { action: "USER_CREATED", entityId: created.id },
    });
    expect(createdAudit).toBeTruthy();
    expect(JSON.stringify(createdAudit)).not.toMatch(/5555/);
  });

  it("changes role, resets PIN, and activates or deactivates without touching history", async () => {
    const admin = await adminActor();
    const created = await createUser({
      name: `Admin Test Role ${Date.now()}`,
      role: "WAITER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(created.id);

    const ordersForUser = () => prisma.order.count({ where: { waiterId: created.id } });
    const paymentsForUser = () => prisma.payment.count({ where: { cashierId: created.id } });
    const movesForUser = () => prisma.inventoryMovement.count({ where: { userId: created.id } });

    expect(await ordersForUser()).toBe(0);
    expect(await paymentsForUser()).toBe(0);
    expect(await movesForUser()).toBe(0);

    const changed = await updateUser({
      id: created.id,
      name: created.name,
      role: "CASHIER",
      active: true,
      actorId: admin.id,
    });
    expect(changed.role).toBe("CASHIER");
    expect(changed).not.toHaveProperty("pinHash");

    const roleAudit = await prisma.auditLog.findFirst({
      where: { action: "PERMISSION_CHANGED", entityId: created.id },
    });
    expect(roleAudit).toBeTruthy();
    expect(JSON.stringify(roleAudit)).not.toMatch(/5555|6666/);

    await changePin({ id: created.id, pin: "6666", actorId: admin.id });
    const afterPin = await prisma.user.findUnique({ where: { id: created.id } });
    expect(await verifyPin("5555", afterPin!.pinHash)).toBe(false);
    expect(await verifyPin("6666", afterPin!.pinHash)).toBe(true);

    const pinAudit = await prisma.auditLog.findFirst({
      where: { action: "PIN_CHANGED", entityId: created.id },
    });
    expect(pinAudit).toBeTruthy();
    expect(JSON.stringify(pinAudit)).not.toMatch(/5555|6666/);

    await updateUser({
      id: created.id,
      active: false,
      actorId: admin.id,
    });
    const afterDeactivate = await prisma.user.findUnique({ where: { id: created.id } });
    expect(afterDeactivate?.role).toBe("CASHIER");
    const loginWhileInactive = await listStaffForLogin();
    expect(loginWhileInactive.find((user) => user.id === created.id)).toBeUndefined();

    const deactivated = await prisma.auditLog.findFirst({
      where: { action: "USER_DEACTIVATED", entityId: created.id },
    });
    expect(deactivated).toBeTruthy();

    await updateUser({
      id: created.id,
      name: created.name,
      role: "CASHIER",
      active: true,
      actorId: admin.id,
    });
    const loginAfterActivate = await listStaffForLogin();
    expect(loginAfterActivate.find((user) => user.id === created.id)).toBeTruthy();

    const activated = await prisma.auditLog.findFirst({
      where: { action: "USER_ACTIVATED", entityId: created.id },
    });
    expect(activated).toBeTruthy();

    expect(await ordersForUser()).toBe(0);
    expect(await paymentsForUser()).toBe(0);
    expect(await movesForUser()).toBe(0);
  });

  it("does not let an admin deactivate themselves", async () => {
    const admin = await adminActor();
    await expect(
      updateUser({
        id: admin.id,
        name: admin.name,
        role: admin.role,
        active: false,
        actorId: admin.id,
      }),
    ).rejects.toThrow("You cannot deactivate your own account.");
  });
});
