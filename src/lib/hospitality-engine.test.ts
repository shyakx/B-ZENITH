import "dotenv/config";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { prisma } from "./prisma";
import {
  postOrder,
  approveVoid,
  processReturn,
  processExchange,
  updateFulfillment,
  processHandover,
  HospitalityError,
} from "./hospitality-service";
import { getLocationByCode } from "./location-stock";
import { verifyManagerApproval } from "./manager-approval";
import { ServiceChannel, SessionStatus, ItemStatus, FulfillmentStatus, ItemCondition, StaffActionType } from "@prisma/client";

const TEST_PIN = "2491";

describe("HOSPITALITY ENGINE & INVENTORY TESTS", async () => {
  const waiter = await prisma.user.findFirst({ where: { role: "WAITER" } });
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER" } });
  const drink = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "BAR" } },
  });
  const food = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "KITCHEN" } },
  });
  if (!waiter || !manager || !drink || !food) {
    throw new Error("Test prerequisites not met. Ensure seed data exists.");
  }

  const waiterId = waiter.id;
  const waiterRole = waiter.role;
  const managerId = manager.id;
  const drinkId = drink.id;
  const foodId = food.id;
  const barLoc = await getLocationByCode(prisma, "BAR");
  const kitchenLoc = await getLocationByCode(prisma, "KITCHEN");
  const createdSessionIds: string[] = [];

  const stockSnapshot = await prisma.productLocationStock.findMany({
    where: { productId: { in: [drinkId, foodId] } },
  });
  const productSnapshot = await prisma.product.findMany({
    where: { id: { in: [drinkId, foodId] } },
    select: { id: true, stockQuantity: true, sellingLocationId: true },
  });
  const pinSnapshot = await prisma.user.findUniqueOrThrow({
    where: { id: managerId },
    select: { pinHash: true, pinFailedAttempts: true, pinLockedUntil: true },
  });

  async function stock(productId: string, locationId: string) {
    return (
      await prisma.productLocationStock.findUnique({
        where: { productId_locationId: { productId, locationId } },
      })
    )?.quantity ?? 0;
  }

  async function ensureStock(productId: string, locationId: string, quantity: number) {
    await prisma.productLocationStock.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity },
      update: { quantity },
    });
  }

  before(async () => {
    await prisma.user.update({
      where: { id: managerId },
      data: { pinHash: await hash(TEST_PIN, 12), pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await ensureStock(drinkId, barLoc.id, 100);
    await ensureStock(foodId, kitchenLoc.id, 100);
  });

  after(async () => {
    const items = await prisma.sessionItem.findMany({
      where: { round: { sessionId: { in: createdSessionIds } } },
      select: { id: true },
    });
    if (items.length > 0) {
      await prisma.inventoryMovement.deleteMany({ where: { referenceId: { in: items.map((item) => item.id) } } });
    }
    if (createdSessionIds.length > 0) {
      await prisma.orderAdjustment.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
      await prisma.serviceSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    await prisma.user.update({
      where: { id: managerId },
      data: pinSnapshot,
    });
    const snapshotIds = new Set(stockSnapshot.map((row) => row.id));
    const current = await prisma.productLocationStock.findMany({
      where: { productId: { in: [drinkId, foodId] } },
    });
    for (const row of current) {
      if (!snapshotIds.has(row.id)) {
        await prisma.productLocationStock.delete({ where: { id: row.id } });
      }
    }
    for (const row of stockSnapshot) {
      await prisma.productLocationStock.update({
        where: { id: row.id },
        data: { quantity: row.quantity },
      });
    }
    for (const product of productSnapshot) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: product.stockQuantity, sellingLocationId: product.sellingLocationId },
      });
    }
  });

  async function createSession() {
    const session = await prisma.serviceSession.create({
      data: {
        channel: ServiceChannel.TABLE,
        waiterId,
        status: SessionStatus.ACTIVE,
      },
    });
    createdSessionIds.push(session.id);
    return session;
  }

  async function approveAsManager() {
    return verifyManagerApproval({
      managerUserId: managerId,
      managerPin: TEST_PIN,
      requesterId: waiterId,
      requesterRole: waiterRole,
      allowSelfApproval: false,
    });
  }

  test("TEST 1 & 2: Post order deducts correct location stock", async () => {
    const session = await createSession();
    await postOrder(session.id, waiterId, [
      { productId: drinkId, quantity: 2, unitPrice: 2000 },
      { productId: foodId, quantity: 1, unitPrice: 5000 },
    ]);
    assert.equal(await stock(drinkId, barLoc.id), 98);
    assert.equal(await stock(foodId, kitchenLoc.id), 99);
  });

  test("TEST 3: Idempotency - Same key twice", async () => {
    const session = await createSession();
    const key = `key-${Date.now()}`;
    const items = [{ productId: drinkId, quantity: 1, unitPrice: 2000 }];
    const round1 = await postOrder(session.id, waiterId, items, key);
    const round2 = await postOrder(session.id, waiterId, items, key);
    assert.equal(round1.id, round2.id);
    assert.equal(await prisma.orderRound.count({ where: { idempotencyKey: key } }), 1);
  });

  test("TEST 5: Void restores exact original location", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 5, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    const beforeVoid = await stock(drinkId, barLoc.id);
    const approver = await approveAsManager();
    await approveVoid(item!.id, waiterId, approver.id, "Wrong order");
    assert.equal(await stock(drinkId, barLoc.id), beforeVoid + 5);
    const updatedItem = await prisma.sessionItem.findUnique({ where: { id: item!.id } });
    assert.equal(updatedItem?.status, ItemStatus.VOIDED);
    const adjustment = await prisma.orderAdjustment.findFirst({ where: { originalItemId: item!.id, type: "VOID" } });
    assert.equal(adjustment?.requestedById, waiterId);
    assert.equal(adjustment?.approvedById, managerId);
  });

  test("TEST 6: Void already voided item fails without second restoration", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 2, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    await approveVoid(item!.id, waiterId, managerId, "first");
    const afterFirst = await stock(drinkId, barLoc.id);
    await assert.rejects(
      () => approveVoid(item!.id, waiterId, managerId, "second"),
      (error: unknown) => error instanceof HospitalityError && error.code === "CONFLICT",
    );
    assert.equal(await stock(drinkId, barLoc.id), afterFirst);
  });

  test("TEST 7 & 8: Return (RESELLABLE vs DAMAGED)", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [
      { productId: drinkId, quantity: 1, unitPrice: 2000 },
      { productId: foodId, quantity: 1, unitPrice: 5000 },
    ]);
    const drinkItem = await prisma.sessionItem.findFirst({ where: { roundId: round.id, productId: drinkId } });
    const foodItem = await prisma.sessionItem.findFirst({ where: { roundId: round.id, productId: foodId } });
    const drinkBefore = await stock(drinkId, barLoc.id);
    const foodBefore = await stock(foodId, kitchenLoc.id);
    const approver = await approveAsManager();

    await processReturn(drinkItem!.id, waiterId, approver.id, {
      quantity: 1,
      reason: "Wrong temperature",
      condition: ItemCondition.RESELLABLE,
    });
    assert.equal(await stock(drinkId, barLoc.id), drinkBefore + 1);

    await processReturn(foodItem!.id, waiterId, approver.id, {
      quantity: 1,
      reason: "Tastes bad",
      condition: ItemCondition.DAMAGED,
    });
    assert.equal(await stock(foodId, kitchenLoc.id), foodBefore);
    const wasteMove = await prisma.inventoryMovement.findFirst({ where: { type: "WASTE", referenceId: foodItem!.id } });
    assert.ok(wasteMove);
  });

  test("TEST 9: Exchange A -> B", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const original = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    const drinkBefore = await stock(drinkId, barLoc.id);
    const foodBefore = await stock(foodId, kitchenLoc.id);
    const approver = await approveAsManager();
    await processExchange(
      original!.id,
      waiterId,
      approver.id,
      { productId: foodId, quantity: 1, unitPrice: 5000 },
      "Changed mind",
    );
    assert.equal(await stock(drinkId, barLoc.id), drinkBefore + 1);
    assert.equal(await stock(foodId, kitchenLoc.id), foodBefore - 1);
    const adj = await prisma.orderAdjustment.findFirst({ where: { type: "EXCHANGE", originalItemId: original!.id } });
    assert.ok(adj?.replacementItemId);
    assert.equal(adj?.requestedById, waiterId);
    assert.equal(adj?.approvedById, approver.id);
  });

  test("concurrent voids restore stock once", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 3, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    const before = await stock(drinkId, barLoc.id);
    const results = await Promise.allSettled([
      approveVoid(item!.id, waiterId, managerId, "race-a"),
      approveVoid(item!.id, waiterId, managerId, "race-b"),
    ]);
    const wins = results.filter((result) => result.status === "fulfilled").length;
    const losses = results.filter((result) => result.status === "rejected").length;
    assert.equal(wins, 1);
    assert.equal(losses, 1);
    assert.equal(await stock(drinkId, barLoc.id), before + 3);
    assert.equal(await prisma.orderAdjustment.count({ where: { originalItemId: item!.id, type: "VOID" } }), 1);
  });

  test("concurrent returns restore stock once", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 2, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    const before = await stock(drinkId, barLoc.id);
    const input = { quantity: 2, reason: "race return", condition: ItemCondition.RESELLABLE };
    const results = await Promise.allSettled([
      processReturn(item!.id, waiterId, managerId, input),
      processReturn(item!.id, waiterId, managerId, input),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await stock(drinkId, barLoc.id), before + 2);
  });

  test("concurrent exchanges restore original once", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const original = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    const drinkBefore = await stock(drinkId, barLoc.id);
    const replacement = { productId: foodId, quantity: 1, unitPrice: 5000 };
    const results = await Promise.allSettled([
      processExchange(original!.id, waiterId, managerId, replacement, "race-a"),
      processExchange(original!.id, waiterId, managerId, replacement, "race-b"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await stock(drinkId, barLoc.id), drinkBefore + 1);
    assert.equal(await prisma.sessionItem.count({ where: { id: original!.id, status: ItemStatus.EXCHANGED } }), 1);
  });

  test("TEST 11: Fulfillment History", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    await updateFulfillment(item!.id, managerId, FulfillmentStatus.PREPARING);
    await updateFulfillment(item!.id, managerId, FulfillmentStatus.READY);
    await updateFulfillment(item!.id, waiterId, FulfillmentStatus.SERVED);
    const history = await prisma.sessionItemFulfillmentHistory.findMany({
      where: { sessionItemId: item!.id },
      orderBy: { timestamp: "asc" },
    });
    assert.equal(history.length, 3);
    assert.equal(history[0].status, FulfillmentStatus.PREPARING);
    assert.equal(history[2].staffId, waiterId);
  });

  test("TEST 12: Handover Accountability", async () => {
    const session = await createSession();
    const targetWaiter =
      (await prisma.user.findFirst({ where: { role: "WAITER", active: true, NOT: { id: waiterId } } })) ??
      (await prisma.user.findFirst({ where: { role: "BILLIARD", active: true, NOT: { id: waiterId } } }));
    if (!targetWaiter) throw new Error("Need a second staff user for handover tests.");
    const approver = await approveAsManager();
    await processHandover(session.id, targetWaiter.id, approver.id, "Shift end");
    const updatedSession = await prisma.serviceSession.findUnique({ where: { id: session.id } });
    assert.equal(updatedSession?.waiterId, targetWaiter.id);
    const history = await prisma.sessionStaffHistory.findFirst({
      where: { sessionId: session.id, action: StaffActionType.HANDOVER },
    });
    assert.equal(history?.previousStaffId, waiterId);
    assert.equal(history?.staffId, targetWaiter.id);
    assert.ok(history?.note?.includes(approver.id));
  });

  test("TEST 13: restoration location snapshot", async () => {
    const session = await createSession();
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirst({ where: { roundId: round.id } });
    await prisma.product.update({ where: { id: drinkId }, data: { sellingLocationId: kitchenLoc.id } });
    const barBefore = await stock(drinkId, barLoc.id);
    const kitchenBefore = await stock(drinkId, kitchenLoc.id);
    await approveVoid(item!.id, waiterId, managerId, "Config change test");
    assert.equal(await stock(drinkId, barLoc.id), barBefore + 1);
    assert.equal(await stock(drinkId, kitchenLoc.id), kitchenBefore);
    await prisma.product.update({ where: { id: drinkId }, data: { sellingLocationId: barLoc.id } });
  });
});
