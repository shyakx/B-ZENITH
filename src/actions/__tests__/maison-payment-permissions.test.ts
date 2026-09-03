import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it, vi } from "vitest";
import { payMaisonAction } from "@/actions/maison";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createMaisonRecord } from "@/services/maison";

loadEnvConfig(process.cwd());

const { testActor } = vi.hoisted(() => ({
  testActor: { id: "", name: "Test", role: "MANAGER" as Role },
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

const createdMaisonIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdMaisonIds.length > 0) {
    const payments = await prisma.maisonPayment.findMany({
      where: { maisonRecordId: { in: createdMaisonIds } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...createdMaisonIds, ...payments.map((row) => row.id)] } },
    });
    await prisma.maisonPayment.deleteMany({ where: { maisonRecordId: { in: createdMaisonIds } } });
    await prisma.maisonRecord.deleteMany({ where: { id: { in: createdMaisonIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

async function staff() {
  const existingOwner = await prisma.user.findFirst({
    where: { role: "OWNER", active: true, deletedAt: null },
  });
  const owner =
    existingOwner ??
    (await prisma.user.create({
      data: {
        name: "Maison Action Test Owner",
        role: "OWNER",
        pinHash: "maison-action-test-owner-not-a-login-pin",
        active: true,
      },
    }));
  if (!existingOwner) createdUserIds.push(owner.id);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true, deletedAt: null } });
  const manager = await prisma.user.findFirst({ where: { name: "Patrick", role: "MANAGER" } });
  const cashier = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
  const waiter = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
  if (!admin || !manager || !cashier || !waiter) {
    throw new Error("Seed staff is required (Admin, Patrick, Grace, John).");
  }
  return { owner, admin, manager, cashier, waiter };
}

async function stay(amount: number, staffId: string) {
  const record = await createMaisonRecord({
    customerName: `Maison action ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date(),
    amount,
    paidAmount: 0,
    staffId,
  });
  createdMaisonIds.push(record.id);
  return record;
}

describe("Maison payment action authorization", () => {
  it("lets OWNER, ADMIN, and MANAGER pay, and denies CASHIER and WAITER at the action gate", async () => {
    const { owner, admin, manager, cashier, waiter } = await staff();

    testActor.id = owner.id;
    testActor.name = owner.name;
    testActor.role = "OWNER";
    const ownerStay = await stay(8_000, owner.id);
    const ownerPay = await payMaisonAction({
      id: ownerStay.id,
      amount: 1_000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(ownerPay.ok).toBe(true);

    testActor.id = admin.id;
    testActor.name = admin.name;
    testActor.role = "ADMIN";
    const adminStay = await stay(8_000, admin.id);
    const adminPay = await payMaisonAction({
      id: adminStay.id,
      amount: 1_000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(adminPay.ok).toBe(true);

    testActor.id = manager.id;
    testActor.name = manager.name;
    testActor.role = "MANAGER";
    const managerStay = await stay(8_000, manager.id);
    const managerPay = await payMaisonAction({
      id: managerStay.id,
      amount: 1_000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(managerPay.ok).toBe(true);

    const cashierStay = await stay(8_000, manager.id);
    testActor.id = cashier.id;
    testActor.name = cashier.name;
    testActor.role = "CASHIER";
    const cashierPay = await payMaisonAction({
      id: cashierStay.id,
      amount: 1_000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(cashierPay.ok).toBe(false);
    if (!cashierPay.ok) expect(cashierPay.error).toBe("You are not allowed to do this.");

    const waiterStay = await stay(8_000, manager.id);
    testActor.id = waiter.id;
    testActor.name = waiter.name;
    testActor.role = "WAITER";
    const waiterPay = await payMaisonAction({
      id: waiterStay.id,
      amount: 1_000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(waiterPay.ok).toBe(false);
    if (!waiterPay.ok) expect(waiterPay.error).toBe("You are not allowed to do this.");

    expect(await prisma.maisonPayment.count({ where: { maisonRecordId: cashierStay.id } })).toBe(0);
    expect(await prisma.maisonPayment.count({ where: { maisonRecordId: waiterStay.id } })).toBe(0);
  });
});
