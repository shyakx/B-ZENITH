import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { hash } from "bcryptjs";
import { ApprovalError, managerMaySelfApprove, verifyManagerApproval } from "./manager-approval";
import { prisma } from "./prisma";

const TEST_PIN = "2491";
const WRONG_PIN = "0000";

describe("manager PIN approval", async () => {
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER", active: true } });
  const waiter = await prisma.user.findFirst({ where: { role: "WAITER", active: true } });
  if (!manager || !waiter) {
    throw new Error("Need an active manager and waiter to test approval.");
  }

  const pinSelect = { pinHash: true, pinFailedAttempts: true, pinLockedUntil: true } as const;
  const managerPinSnapshot = await prisma.user.findUniqueOrThrow({
    where: { id: manager.id },
    select: pinSelect,
  });
  const waiterPinSnapshot = await prisma.user.findUniqueOrThrow({
    where: { id: waiter.id },
    select: pinSelect,
  });

  before(async () => {
    const testHash = await hash(TEST_PIN, 12);
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinHash: testHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await prisma.user.update({
      where: { id: waiter.id },
      data: { pinHash: testHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });
  });

  after(async () => {
    await prisma.user.update({
      where: { id: manager.id },
      data: managerPinSnapshot,
    });
    await prisma.user.update({
      where: { id: waiter.id },
      data: waiterPinSnapshot,
    });
  });

  test("valid manager PIN approves", async () => {
    const approved = await verifyManagerApproval({
      managerUserId: manager.id,
      managerPin: TEST_PIN,
      requesterId: waiter.id,
      requesterRole: waiter.role,
      allowSelfApproval: managerMaySelfApprove(waiter.role),
      action: "VOID",
    });
    assert.equal(approved.id, manager.id);
    assert.equal("pinHash" in approved, false);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: manager.id },
      select: { pinFailedAttempts: true, pinLockedUntil: true },
    });
    assert.equal(after.pinFailedAttempts, 0);
    assert.equal(after.pinLockedUntil, null);
  });

  test("wrong PIN is rejected and increments lockout counters", async () => {
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: manager.id,
          managerPin: WRONG_PIN,
          requesterId: waiter.id,
          requesterRole: waiter.role,
          allowSelfApproval: false,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: manager.id },
      select: { pinFailedAttempts: true },
    });
    assert.equal(after.pinFailedAttempts, 1);
  });

  test("locked manager PIN is rejected without extra increment", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60_000);
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinFailedAttempts: 5, pinLockedUntil: lockedUntil },
    });
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: manager.id,
          managerPin: TEST_PIN,
          requesterId: waiter.id,
          requesterRole: waiter.role,
          allowSelfApproval: false,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: manager.id },
      select: { pinFailedAttempts: true },
    });
    assert.equal(after.pinFailedAttempts, 5);
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
  });

  test("waiter cannot approve with their own PIN", async () => {
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: waiter.id,
          managerPin: TEST_PIN,
          requesterId: waiter.id,
          requesterRole: waiter.role,
          allowSelfApproval: false,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );
  });

  test("unauthorized role is rejected even with a valid PIN", async () => {
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: waiter.id,
          managerPin: TEST_PIN,
          requesterId: manager.id,
          requesterRole: manager.role,
          allowSelfApproval: true,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );
  });

  test("invalid managerUserId is rejected", async () => {
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: "clinvalidmanager00000000001",
          managerPin: TEST_PIN,
          requesterId: waiter.id,
          requesterRole: waiter.role,
          allowSelfApproval: false,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );
  });

  test("successful verification clears failed attempts", async () => {
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinFailedAttempts: 3, pinLockedUntil: null },
    });
    await verifyManagerApproval({
      managerUserId: manager.id,
      managerPin: TEST_PIN,
      requesterId: waiter.id,
      requesterRole: waiter.role,
      allowSelfApproval: false,
    });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: manager.id },
      select: { pinFailedAttempts: true, pinLockedUntil: true },
    });
    assert.equal(after.pinFailedAttempts, 0);
    assert.equal(after.pinLockedUntil, null);
  });

  test("manager may self-approve only when allowSelfApproval is true", async () => {
    await assert.rejects(
      () =>
        verifyManagerApproval({
          managerUserId: manager.id,
          managerPin: TEST_PIN,
          requesterId: manager.id,
          requesterRole: manager.role,
          allowSelfApproval: false,
        }),
      (error: unknown) => error instanceof ApprovalError && error.status === 403,
    );

    const approved = await verifyManagerApproval({
      managerUserId: manager.id,
      managerPin: TEST_PIN,
      requesterId: manager.id,
      requesterRole: manager.role,
      allowSelfApproval: managerMaySelfApprove(manager.role),
    });
    assert.equal(approved.id, manager.id);
  });
});
