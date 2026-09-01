import { loadEnvConfig } from "@next/env";
import { PaymentMethod } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { isLiveStaffAccount } from "@/lib/auth/staff-account";
import { verifyPin } from "@/lib/auth/pin";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/services/orders";
import { recordPayment } from "@/services/payments";
import { salesSummary } from "@/services/reports";
import {
  changeOwnPin,
  changePin,
  countActiveOwners,
  createUser,
  deleteStaff,
  listStaffForLogin,
  listUsers,
  updateUser,
} from "@/services/users";
import { cleanupInventoryArtifacts, createIsolatedPosProduct } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdUserIds: string[] = [];
const createdTableIds: string[] = [];
const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { waiterId: { in: createdUserIds } },
      select: { id: true, orderNumber: true },
    });
    const orderIds = orders.map((order) => order.id);
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.payment.deleteMany({
      where: {
        OR: [{ cashierId: { in: createdUserIds } }, { orderId: { in: orderIds } }],
      },
    });
    await prisma.creditRecord.deleteMany({
      where: {
        OR: [
          { recordedById: { in: createdUserIds } },
          { settledById: { in: createdUserIds } },
          { orderId: { in: orderIds } },
        ],
      },
    });
    await prisma.inventoryMovement.deleteMany({
      where: {
        OR: [{ userId: { in: createdUserIds } }, { reference: { in: numbers } }],
      },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityId: { in: createdUserIds } }, { userId: { in: createdUserIds } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdTableIds.length > 0) {
    await prisma.serviceTable.deleteMany({ where: { id: { in: createdTableIds } } });
  }
  if (createdProductIds.length > 0) {
    await cleanupInventoryArtifacts(createdProductIds);
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
  await prisma.$disconnect();
});

async function adminActor() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Seed data is required for this test (an active Admin).");
  return admin;
}

describe.sequential("admin staff management against the database", () => {
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

  it("lets staff set their own PIN and then sign in with it", async () => {
    const admin = await adminActor();
    const created = await createUser({
      name: `Own Pin ${Date.now()}`,
      role: "WAITER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(created.id);

    await expect(
      changeOwnPin({ userId: created.id, pin: "8899", confirmPin: "8800" }),
    ).rejects.toThrow(/must match/);

    await changeOwnPin({ userId: created.id, pin: "8899", confirmPin: "8899" });
    const after = await prisma.user.findUnique({ where: { id: created.id } });
    expect(await verifyPin("5555", after!.pinHash)).toBe(false);
    expect(await verifyPin("8899", after!.pinHash)).toBe(true);
    expect(JSON.stringify(after)).not.toMatch(/8899|5555/);
  });

  it("deletes the login identity and keeps orders, payments, stock, and audit", async () => {
    const admin = await adminActor();
    const cashier = await prisma.user.findFirst({ where: { role: "CASHIER", active: true } });
    if (!cashier) throw new Error("Seed data is required (an active Cashier).");

    const waiter = await createUser({
      name: `Delete History ${Date.now()}`,
      role: "WAITER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(waiter.id);

    const isolated = await createIsolatedPosProduct({ sellingPrice: 1500, barQuantity: 20 });
    createdProductIds.push(isolated.product.id);
    createdCategoryIds.push(isolated.category.id);
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-DEL-${Date.now()}`, sortOrder: 9101 },
    });
    createdTableIds.push(table.id);

    const order = await createOrder({
      waiterId: waiter.id,
      tableId: table.id,
      items: [{ productId: isolated.product.id, quantity: 1 }],
      idempotencyKey: `test-delete-history-${Date.now()}`,
    });
    await recordPayment({
      orderId: order.id,
      amount: 1500,
      method: PaymentMethod.CASH,
      cashierId: cashier.id,
      idempotencyKey: `test-delete-pay-${Date.now()}`,
    });

    const ordersBefore = await prisma.order.count({ where: { waiterId: waiter.id } });
    const paymentsBefore = await prisma.payment.count({ where: { orderId: order.id } });
    const movesBefore = await prisma.inventoryMovement.count({
      where: { OR: [{ userId: waiter.id }, { reference: String(order.orderNumber) }] },
    });
    expect(ordersBefore).toBe(1);
    expect(paymentsBefore).toBe(1);
    expect(movesBefore).toBeGreaterThan(0);

    await deleteStaff({ id: waiter.id, actorId: admin.id });

    const row = await prisma.user.findUnique({ where: { id: waiter.id } });
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.active).toBe(false);
    expect(await verifyPin("5555", row!.pinHash)).toBe(false);
    expect(await listStaffForLogin().then((staff) => staff.find((user) => user.id === waiter.id))).toBeUndefined();
    expect(await listUsers().then((staff) => staff.find((user) => user.id === waiter.id))).toBeUndefined();

    expect(await prisma.order.count({ where: { id: order.id, waiterId: waiter.id } })).toBe(1);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { OR: [{ userId: waiter.id }, { reference: String(order.orderNumber) }] },
      }),
    ).toBe(movesBefore);

    const deletedAudit = await prisma.auditLog.findFirst({
      where: { action: "USER_DELETED", entityId: waiter.id, userId: admin.id },
    });
    expect(deletedAudit).toBeTruthy();
    expect(JSON.stringify(deletedAudit)).toMatch(/WAITER/);
    expect(JSON.stringify(deletedAudit)).not.toMatch(/5555/);
    expect(deletedAudit?.userId).toBe(admin.id);

    await expect(updateUser({ id: waiter.id, active: true, actorId: admin.id })).rejects.toThrow(
      "Staff member not found.",
    );
    await expect(changePin({ id: waiter.id, pin: "8888", actorId: admin.id })).rejects.toThrow(
      "Staff member not found.",
    );

    const attributed = await prisma.order.findUnique({
      where: { id: order.id },
      include: { waiter: { select: { id: true, name: true, deletedAt: true } } },
    });
    expect(attributed?.waiter.id).toBe(waiter.id);
    expect(attributed?.waiter.name).toBe(waiter.name);
    expect(attributed?.waiter.deletedAt).toBeTruthy();

    const summary = await salesSummary(
      new Date(order.createdAt.getTime() - 60_000),
      new Date(order.createdAt.getTime() + 60_000),
    );
    expect(summary.waiters.some((person) => person.name === waiter.name)).toBe(true);
    expect(isLiveStaffAccount(row)).toBe(false);
  });

  it("blocks ADMIN from granting OWNER and protects the last active owner", async () => {
    const admin = await adminActor();
    const owner = await createUser({
      name: `Owner Guard ${Date.now()}`,
      role: "OWNER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(owner.id);

    await expect(
      createUser({
        name: `Blocked Owner ${Date.now()}`,
        role: "OWNER",
        pin: "5555",
        actorId: admin.id,
      }),
    ).rejects.toThrow("Only an owner can create an owner account.");

    const waiter = await createUser({
      name: `No Promote ${Date.now()}`,
      role: "WAITER",
      pin: "5555",
      actorId: admin.id,
    });
    createdUserIds.push(waiter.id);
    await expect(
      updateUser({ id: waiter.id, role: "OWNER", actorId: admin.id }),
    ).rejects.toThrow("Only an owner can create, promote, or demote an owner account.");

    await expect(deleteStaff({ id: owner.id, actorId: admin.id })).rejects.toThrow(
      "Only an owner can delete an owner account.",
    );
    await expect(updateUser({ id: owner.id, active: false, actorId: admin.id })).rejects.toThrow(
      "Only an owner can change an owner account.",
    );

    await expect(deleteStaff({ id: owner.id, actorId: owner.id })).rejects.toThrow(
      /last active owner cannot be deleted/i,
    );
    await expect(updateUser({ id: owner.id, active: false, actorId: owner.id })).rejects.toThrow(
      /last active owner cannot be deactivated/i,
    );
    await expect(updateUser({ id: owner.id, role: "ADMIN", actorId: owner.id })).rejects.toThrow(
      /last active owner cannot have their role changed/i,
    );

    const second = await createUser({
      name: `Owner Two ${Date.now()}`,
      role: "OWNER",
      pin: "5555",
      actorId: owner.id,
    });
    createdUserIds.push(second.id);

    await deleteStaff({ id: second.id, actorId: owner.id });
    const secondRow = await prisma.user.findUnique({ where: { id: second.id } });
    expect(secondRow?.deletedAt).toBeTruthy();

    await expect(deleteStaff({ id: owner.id, actorId: owner.id })).rejects.toThrow(
      /last active owner cannot be deleted/i,
    );
    await expect(updateUser({ id: owner.id, active: false, actorId: owner.id })).rejects.toThrow(
      /last active owner cannot be deactivated/i,
    );
  });

  it("keeps at least one active owner when two owners are deleted at once", async () => {
    const admin = await adminActor();
    const existingA = await prisma.user.findFirst({
      where: { id: { in: createdUserIds }, role: "OWNER", active: true, deletedAt: null },
      select: { id: true },
    });
    const ownerA =
      existingA ??
      (await createUser({
        name: `Owner Race A ${Date.now()}`,
        role: "OWNER",
        pin: "5555",
        actorId: admin.id,
      }));
    if (!existingA) createdUserIds.push(ownerA.id);

    const ownerB = await createUser({
      name: `Owner Race B ${Date.now()}`,
      role: "OWNER",
      pin: "5555",
      actorId: ownerA.id,
    });
    createdUserIds.push(ownerB.id);

    const results = await Promise.allSettled([
      deleteStaff({ id: ownerA.id, actorId: ownerB.id }),
      deleteStaff({ id: ownerB.id, actorId: ownerA.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await countActiveOwners()).toBe(1);

    const remaining = await prisma.user.findMany({
      where: { id: { in: [ownerA.id, ownerB.id] }, role: "OWNER", active: true, deletedAt: null },
    });
    expect(remaining).toHaveLength(1);
  });
});
