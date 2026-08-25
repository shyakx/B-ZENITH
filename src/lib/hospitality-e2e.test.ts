import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { hash } from "bcryptjs";
import {
  FulfillmentStatus,
  ItemCondition,
  ItemStatus,
  PaymentMethod,
  ServiceChannel,
  SessionStatus,
  StaffActionType,
} from "@prisma/client";
import { loadHospitalityReceipt } from "./hospitality-receipt";
import { loadHospitalityReport } from "./hospitality-reporting";
import {
  HospitalityError,
  approveVoid,
  assertWaiterOwnsSession,
  finalizeSettlement,
  openServiceSession,
  postOrder,
  processExchange,
  processHandover,
  processReturn,
  requireOperableSession,
  updateFulfillment,
} from "./hospitality-service";
import { getLocationByCode } from "./location-stock";
import { prisma } from "./prisma";

const TEST_PIN = "2491";

describe("HOSPITALITY PHASE 5.3 E2E", async () => {
  const waiter = await prisma.user.findFirst({ where: { role: "WAITER", active: true } });
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER", active: true } });
  const drink = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "BAR" } },
  });
  const food = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "KITCHEN" } },
  });
  if (!waiter || !manager || !drink || !food) {
    throw new Error("Need waiter, manager, bar product, and kitchen product.");
  }
  const secondWaiter =
    (await prisma.user.findFirst({ where: { role: "WAITER", active: true, NOT: { id: waiter.id } } })) ??
    (await prisma.user.findFirst({ where: { role: "BILLIARD", active: true, NOT: { id: waiter.id } } }));
  if (!secondWaiter) throw new Error("Need a second staff user.");

  const waiterId = waiter.id;
  const managerId = manager.id;
  const otherStaffId = secondWaiter.id;
  const drinkId = drink.id;
  const foodId = food.id;
  const barLoc = await getLocationByCode(prisma, "BAR");
  const kitchenLoc = await getLocationByCode(prisma, "KITCHEN");
  const createdSessionIds: string[] = [];
  const createdTableIds: string[] = [];

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
  const settingsSnapshot = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: { receiptSequence: true },
  });

  async function stock(productId: string, locationId: string) {
    return (
      (
        await prisma.productLocationStock.findUnique({
          where: { productId_locationId: { productId, locationId } },
        })
      )?.quantity ?? 0
    );
  }

  before(async () => {
    await prisma.user.update({
      where: { id: managerId },
      data: { pinHash: await hash(TEST_PIN, 12), pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await prisma.productLocationStock.upsert({
      where: { productId_locationId: { productId: drinkId, locationId: barLoc.id } },
      create: { productId: drinkId, locationId: barLoc.id, quantity: 100 },
      update: { quantity: 100 },
    });
    await prisma.productLocationStock.upsert({
      where: { productId_locationId: { productId: foodId, locationId: kitchenLoc.id } },
      create: { productId: foodId, locationId: kitchenLoc.id, quantity: 100 },
      update: { quantity: 100 },
    });
  });

  after(async () => {
    const items = await prisma.sessionItem.findMany({
      where: { round: { sessionId: { in: createdSessionIds } } },
      select: { id: true },
    });
    if (createdSessionIds.length > 0) {
      await prisma.sale.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
    }
    if (items.length > 0) {
      await prisma.inventoryMovement.deleteMany({ where: { referenceId: { in: items.map((item) => item.id) } } });
    }
    if (createdSessionIds.length > 0) {
      await prisma.orderAdjustment.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
      await prisma.serviceSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    if (createdTableIds.length > 0) {
      await prisma.table.updateMany({ where: { id: { in: createdTableIds } }, data: { status: "AVAILABLE" } });
      await prisma.table.deleteMany({ where: { id: { in: createdTableIds } } });
    }
    await prisma.user.update({ where: { id: managerId }, data: pinSnapshot });
    if (settingsSnapshot) {
      await prisma.businessSettings.update({
        where: { id: "default" },
        data: { receiptSequence: settingsSnapshot.receiptSequence },
      });
    }
    const snapshotIds = new Set(stockSnapshot.map((row) => row.id));
    const current = await prisma.productLocationStock.findMany({
      where: { productId: { in: [drinkId, foodId] } },
    });
    for (const row of current) {
      if (!snapshotIds.has(row.id)) await prisma.productLocationStock.delete({ where: { id: row.id } });
    }
    for (const row of stockSnapshot) {
      await prisma.productLocationStock.update({ where: { id: row.id }, data: { quantity: row.quantity } });
    }
    for (const product of productSnapshot) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: product.stockQuantity, sellingLocationId: product.sellingLocationId },
      });
    }
  });

  async function track<T extends { id: string }>(session: T) {
    createdSessionIds.push(session.id);
    return session;
  }

  test("waiters cannot operate another waiter session", async () => {
    const session = await track(await openServiceSession(waiterId, { channel: ServiceChannel.WALK_IN, customerName: "P53 isolation" }));
    assert.throws(
      () => assertWaiterOwnsSession("WAITER", otherStaffId, session.waiterId),
      (error: unknown) => error instanceof HospitalityError && error.code === "FORBIDDEN",
    );
    await assert.rejects(
      () => requireOperableSession(session.id, { id: otherStaffId, role: "WAITER" }),
      (error: unknown) => error instanceof HospitalityError && error.code === "FORBIDDEN",
    );
    await requireOperableSession(session.id, { id: waiterId, role: "WAITER" });
    await requireOperableSession(session.id, { id: managerId, role: "MANAGER" });
  });

  test("concurrent table open allows only one session", async () => {
    const table = await prisma.table.create({
      data: { name: `P53-${Date.now()}`, status: "AVAILABLE", sortOrder: 9998 },
    });
    createdTableIds.push(table.id);
    const first = await track(await openServiceSession(waiterId, { channel: ServiceChannel.TABLE, tableId: table.id }));
    await assert.rejects(
      () => openServiceSession(otherStaffId, { channel: ServiceChannel.TABLE, tableId: table.id }),
      (error: unknown) => error instanceof HospitalityError && error.code === "CONFLICT",
    );
    assert.equal((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status, "OCCUPIED");
    assert.equal(await prisma.serviceSession.count({ where: { tableId: table.id, status: SessionStatus.ACTIVE } }), 1);
    assert.equal(first.waiterId, waiterId);
  });

  test("complete table journey: post, fulfill, handover, void, settle, receipt, report", async () => {
    const table = await prisma.table.create({
      data: { name: `P53T-${Date.now()}`, status: "AVAILABLE", sortOrder: 9997 },
    });
    createdTableIds.push(table.id);
    const session = await track(await openServiceSession(waiterId, { channel: ServiceChannel.TABLE, tableId: table.id }));
    const barBefore = await stock(drinkId, barLoc.id);
    const kitchenBefore = await stock(foodId, kitchenLoc.id);

    const round1 = await postOrder(session.id, waiterId, [
      { productId: drinkId, quantity: 2, unitPrice: 2000 },
      { productId: foodId, quantity: 1, unitPrice: 5000 },
    ]);
    assert.equal(round1.postedById, waiterId);
    assert.equal(await stock(drinkId, barLoc.id), barBefore - 2);
    assert.equal(await stock(foodId, kitchenLoc.id), kitchenBefore - 1);

    const drinkItem = await prisma.sessionItem.findFirstOrThrow({ where: { roundId: round1.id, productId: drinkId } });
    await updateFulfillment(drinkItem.id, managerId, FulfillmentStatus.PREPARING);
    await updateFulfillment(drinkItem.id, managerId, FulfillmentStatus.READY);
    await updateFulfillment(drinkItem.id, waiterId, FulfillmentStatus.SERVED);
    const history = await prisma.sessionItemFulfillmentHistory.findMany({
      where: { sessionItemId: drinkItem.id },
      orderBy: { timestamp: "asc" },
    });
    assert.equal(history.length, 3);
    assert.equal(history[2].staffId, waiterId);

    const round2 = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    assert.equal(round2.postedById, waiterId);

    await processHandover(session.id, otherStaffId, managerId, "P53 handover");
    const afterHandover = await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(afterHandover.waiterId, otherStaffId);
    const handover = await prisma.sessionStaffHistory.findFirstOrThrow({
      where: { sessionId: session.id, action: StaffActionType.HANDOVER },
    });
    assert.equal(handover.previousStaffId, waiterId);
    assert.equal(handover.staffId, otherStaffId);
    assert.ok(handover.note?.includes(managerId));
    assert.equal((await prisma.orderRound.findUniqueOrThrow({ where: { id: round1.id } })).postedById, waiterId);

    const round3 = await postOrder(session.id, otherStaffId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    assert.equal(round3.postedById, otherStaffId);

    const voidItem = await prisma.sessionItem.findFirstOrThrow({ where: { roundId: round2.id } });
    const barAfterPost = await stock(drinkId, barLoc.id);
    await approveVoid(voidItem.id, otherStaffId, managerId, "P53 guest changed mind");
    assert.notEqual(otherStaffId, managerId);
    assert.equal((await prisma.sessionItem.findUniqueOrThrow({ where: { id: voidItem.id } })).status, ItemStatus.VOIDED);
    assert.equal(await stock(drinkId, barLoc.id), barAfterPost + 1);
    const adj = await prisma.orderAdjustment.findFirstOrThrow({ where: { originalItemId: voidItem.id, type: "VOID" } });
    assert.equal(adj.requestedById, otherStaffId);
    assert.equal(adj.approvedById, managerId);

    const activeItems = await prisma.sessionItem.findMany({
      where: { round: { sessionId: session.id }, status: ItemStatus.ACTIVE },
    });
    const invoice = activeItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
    const stockBeforeSettle = {
      drink: await stock(drinkId, barLoc.id),
      food: await stock(foodId, kitchenLoc.id),
      movements: await prisma.inventoryMovement.count(),
    };
    const sale = await finalizeSettlement(session.id, managerId, {
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: invoice, cashReceived: invoice }],
    });
    assert.equal(Number(sale.total), invoice);
    assert.equal(sale.cashierId, managerId);
    assert.equal(await prisma.payment.count({ where: { saleId: sale.id } }), 1);
    assert.equal((await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } })).status, SessionStatus.CLOSED);
    assert.equal(await stock(drinkId, barLoc.id), stockBeforeSettle.drink);
    assert.equal(await stock(foodId, kitchenLoc.id), stockBeforeSettle.food);
    assert.equal(await prisma.inventoryMovement.count(), stockBeforeSettle.movements);

    const receipt = await loadHospitalityReceipt(sale.id);
    assert.ok(receipt);
    assert.equal(receipt.channel, "TABLE");
    assert.equal(receipt.tableName, table.name);
    assert.equal(receipt.waiterId, otherStaffId);
    assert.equal(receipt.cashierId, managerId);
    assert.notEqual(receipt.waiterId, receipt.cashierId);
    assert.equal(receipt.payments.length, 1);
    assert.equal(receipt.lines.reduce((sum, line) => sum + line.lineTotal, 0), receipt.total);
    assert.ok(!receipt.lines.some((line) => line.quantity < 0));

    const movementsBeforeReport = await prisma.inventoryMovement.count();
    const report = await loadHospitalityReport(new Date(Date.now() - 60_000), new Date(Date.now() + 60_000));
    assert.ok((report.paymentTotals.get("CASH")?.amount ?? 0) >= 11000);
    assert.ok(report.postedBy.get(waiterId));
    assert.ok(report.postedBy.get(otherStaffId));
    assert.ok((report.channelTotals.get("TABLE")?.count ?? 0) >= 1);
    assert.equal(await prisma.inventoryMovement.count(), movementsBeforeReport);
  });

  test("OPENED return does not restore stock and second return is rejected", async () => {
    const session = await track(await openServiceSession(waiterId, { channel: ServiceChannel.WALK_IN }));
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirstOrThrow({ where: { roundId: round.id } });
    const before = await stock(drinkId, barLoc.id);
    await processReturn(item.id, waiterId, managerId, {
      quantity: 1,
      reason: "Already opened",
      condition: ItemCondition.OPENED,
    });
    assert.equal(await stock(drinkId, barLoc.id), before);
    const waste = await prisma.inventoryMovement.findFirst({ where: { type: "WASTE", referenceId: item.id } });
    assert.ok(waste);
    await assert.rejects(
      () =>
        processReturn(item.id, waiterId, managerId, {
          quantity: 1,
          reason: "second",
          condition: ItemCondition.OPENED,
        }),
      (error: unknown) => error instanceof HospitalityError && error.code === "CONFLICT",
    );
    assert.equal(await stock(drinkId, barLoc.id), before);
  });

  test("insufficient exchange stock rolls back original item", async () => {
    const session = await track(await openServiceSession(waiterId, { channel: ServiceChannel.COUNTER, destinationLabel: "Bar Seat 1" }));
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const original = await prisma.sessionItem.findFirstOrThrow({ where: { roundId: round.id } });
    await prisma.productLocationStock.update({
      where: { productId_locationId: { productId: foodId, locationId: kitchenLoc.id } },
      data: { quantity: 0 },
    });
    const drinkBefore = await stock(drinkId, barLoc.id);
    const foodBefore = await stock(foodId, kitchenLoc.id);
    await assert.rejects(
      () =>
        processExchange(
          original.id,
          waiterId,
          managerId,
          { productId: foodId, quantity: 1, unitPrice: 5000 },
          "no kitchen stock",
        ),
    );
    assert.equal((await prisma.sessionItem.findUniqueOrThrow({ where: { id: original.id } })).status, ItemStatus.ACTIVE);
    assert.equal(await stock(drinkId, barLoc.id), drinkBefore);
    assert.equal(await stock(foodId, kitchenLoc.id), foodBefore);
    await prisma.productLocationStock.update({
      where: { productId_locationId: { productId: foodId, locationId: kitchenLoc.id } },
      data: { quantity: 100 },
    });
  });
});
