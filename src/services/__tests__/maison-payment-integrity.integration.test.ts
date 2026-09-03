import { loadEnvConfig } from "@next/env";
import { PaymentStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createMaisonRecord, recordMaisonPayment } from "@/services/maison";

loadEnvConfig(process.cwd());

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
        name: "Maison Test Owner",
        role: "OWNER",
        pinHash: "maison-test-owner-not-a-login-pin",
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

async function stay(amount: number, staffId: string, paidAmount = 0) {
  const record = await createMaisonRecord({
    customerName: `Maison ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date(),
    amount,
    paidAmount,
    staffId,
  });
  createdMaisonIds.push(record.id);
  return record;
}

async function paymentSum(maisonRecordId: string) {
  const rows = await prisma.maisonPayment.findMany({ where: { maisonRecordId } });
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

async function paymentCount(maisonRecordId: string) {
  return prisma.maisonPayment.count({ where: { maisonRecordId } });
}

async function paymentAudits(maisonRecordId: string) {
  const payments = await prisma.maisonPayment.findMany({
    where: { maisonRecordId },
    select: { id: true },
  });
  if (payments.length === 0) return 0;
  return prisma.auditLog.count({
    where: { action: "MAISON_PAYMENT", entityId: { in: payments.map((row) => row.id) } },
  });
}

describe("Maison payment integrity", () => {
  it("records a positive payment and keeps the ledger in sync", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);
    const updated = await recordMaisonPayment({
      id: record.id,
      amount: 40_000,
      staffId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(updated.paidAmount).toBe(40_000);
    expect(updated.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(updated.paidAmount).toBeLessThanOrEqual(updated.amount);
    expect(await paymentSum(record.id)).toBe(40_000);
    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentAudits(record.id)).toBe(1);
  });

  it("rejects zero, negative, and non-integer amounts without writing money or audits", async () => {
    const { manager } = await staff();
    const record = await stay(50_000, manager.id);

    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: 0,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/positive whole number/);
    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: -1000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/positive whole number/);
    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: 10.5,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/positive whole number/);

    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored?.paidAmount).toBe(0);
    expect(await paymentCount(record.id)).toBe(0);
    expect(await paymentAudits(record.id)).toBe(0);
  });

  it("rejects overpayment and already-paid records", async () => {
    const { manager } = await staff();
    const record = await stay(20_000, manager.id);

    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: 20_001,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/remaining balance/);

    await recordMaisonPayment({
      id: record.id,
      amount: 20_000,
      staffId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: 1,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/already paid/);

    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentSum(record.id)).toBe(20_000);
    expect(await paymentAudits(record.id)).toBe(1);
  });

  it("rejects a missing record and a blank idempotency key", async () => {
    const { manager } = await staff();
    await expect(
      recordMaisonPayment({
        id: "missing-maison",
        amount: 1000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/Maison record not found/);
    const record = await stay(10_000, manager.id);
    await expect(
      recordMaisonPayment({
        id: record.id,
        amount: 1000,
        staffId: manager.id,
        idempotencyKey: "   ",
      }),
    ).rejects.toThrow(/Missing payment key/);
    expect(await paymentCount(record.id)).toBe(0);
  });

  it("replays the same key without a second payment, balance change, or audit", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);
    const key = crypto.randomUUID();
    const input = {
      id: record.id,
      amount: 50_000,
      staffId: manager.id,
      idempotencyKey: key,
    };

    const first = await recordMaisonPayment(input);
    const second = await recordMaisonPayment(input);

    expect(second.id).toBe(first.id);
    expect(second.paidAmount).toBe(50_000);
    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentSum(record.id)).toBe(50_000);
    expect(await paymentAudits(record.id)).toBe(1);
  });

  it("serializes concurrent same-key payments into one mutation", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);
    const input = {
      id: record.id,
      amount: 50_000,
      staffId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    };

    const results = await Promise.all([recordMaisonPayment(input), recordMaisonPayment(input)]);

    expect(results[0].paidAmount).toBe(50_000);
    expect(results[1].paidAmount).toBe(50_000);
    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentSum(record.id)).toBe(50_000);
    expect(await paymentAudits(record.id)).toBe(1);
  });

  it("lets only one of two 70,000 payments succeed against 100,000", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);

    const results = await Promise.allSettled([
      recordMaisonPayment({
        id: record.id,
        amount: 70_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
      recordMaisonPayment({
        id: record.id,
        amount: 70_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored?.paidAmount).toBe(70_000);
    expect(stored?.paidAmount).toBeLessThanOrEqual(stored!.amount);
    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentSum(record.id)).toBe(70_000);
    expect(await paymentAudits(record.id)).toBe(1);
  });

  it("accepts serialized 60,000 and 40,000 payments against 100,000", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);

    const results = await Promise.all([
      recordMaisonPayment({
        id: record.id,
        amount: 60_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
      recordMaisonPayment({
        id: record.id,
        amount: 40_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    const paidSnapshots = results.map((row) => row.paidAmount).sort((a, b) => a - b);
    expect(paidSnapshots[1]).toBe(100_000);
    expect(paidSnapshots[0] === 40_000 || paidSnapshots[0] === 60_000).toBe(true);
    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored?.paidAmount).toBe(100_000);
    expect(stored?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(await paymentCount(record.id)).toBe(2);
    expect(await paymentSum(record.id)).toBe(100_000);
    const ledger = await prisma.maisonPayment.findMany({ where: { maisonRecordId: record.id } });
    expect(ledger.map((row) => row.amount).sort((a, b) => a - b)).toEqual([40_000, 60_000]);
    expect(await paymentAudits(record.id)).toBe(2);
  });

  it("lets a full payment win against a competing partial payment", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);

    const results = await Promise.allSettled([
      recordMaisonPayment({
        id: record.id,
        amount: 100_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
      recordMaisonPayment({
        id: record.id,
        amount: 30_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    const ok = results.filter((row) => row.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored?.paidAmount).toBe(ok[0].status === "fulfilled" ? ok[0].value.paidAmount : -1);
    expect(stored?.paidAmount === 100_000 || stored?.paidAmount === 30_000).toBe(true);
    expect(await paymentCount(record.id)).toBe(1);
    expect(await paymentSum(record.id)).toBe(stored?.paidAmount);
    expect(stored!.paidAmount).toBeLessThanOrEqual(stored!.amount);
  });

  it("lets only one payment succeed when only a partial balance remains", async () => {
    const { manager } = await staff();
    const record = await stay(100_000, manager.id);
    await recordMaisonPayment({
      id: record.id,
      amount: 80_000,
      staffId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    const results = await Promise.allSettled([
      recordMaisonPayment({
        id: record.id,
        amount: 20_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
      recordMaisonPayment({
        id: record.id,
        amount: 20_000,
        staffId: manager.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored?.paidAmount).toBe(100_000);
    expect(await paymentCount(record.id)).toBe(2);
    expect(await paymentSum(record.id)).toBe(100_000);
  });

  it("allows OWNER, ADMIN, and MANAGER, and denies CASHIER and WAITER", async () => {
    const { owner, admin, manager, cashier, waiter } = await staff();

    const ownerStay = await stay(9_000, owner.id);
    await recordMaisonPayment({
      id: ownerStay.id,
      amount: 1_000,
      staffId: owner.id,
      idempotencyKey: crypto.randomUUID(),
    });

    const adminStay = await stay(9_000, admin.id);
    await recordMaisonPayment({
      id: adminStay.id,
      amount: 1_000,
      staffId: admin.id,
      idempotencyKey: crypto.randomUUID(),
    });

    const managerStay = await stay(9_000, manager.id);
    await recordMaisonPayment({
      id: managerStay.id,
      amount: 1_000,
      staffId: manager.id,
      idempotencyKey: crypto.randomUUID(),
    });

    const cashierStay = await stay(9_000, manager.id);
    await expect(
      recordMaisonPayment({
        id: cashierStay.id,
        amount: 1_000,
        staffId: cashier.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/not allowed to manage Maison/);

    const waiterStay = await stay(9_000, manager.id);
    const completedKey = crypto.randomUUID();
    await recordMaisonPayment({
      id: waiterStay.id,
      amount: 1_000,
      staffId: manager.id,
      idempotencyKey: completedKey,
    });
    await expect(
      recordMaisonPayment({
        id: waiterStay.id,
        amount: 1_000,
        staffId: waiter.id,
        idempotencyKey: completedKey,
      }),
    ).rejects.toThrow(/not allowed to manage Maison/);

    expect(await paymentCount(cashierStay.id)).toBe(0);
    expect(await paymentAudits(cashierStay.id)).toBe(0);
    expect((await prisma.maisonRecord.findUnique({ where: { id: waiterStay.id } }))?.paidAmount).toBe(1_000);
  });
});
