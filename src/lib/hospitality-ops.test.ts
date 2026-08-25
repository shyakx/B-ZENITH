import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { hash } from "bcryptjs";
import {
  FulfillmentStatus,
  PaymentMethod,
  ServiceChannel,
} from "@prisma/client";
import { loadHospitalityReceipt } from "./hospitality-receipt";
import { loadHospitalityReport } from "./hospitality-reporting";
import {
  HospitalityError,
  finalizeSettlement,
  openServiceSession,
  postOrder,
  processHandover,
  updateFulfillment,
} from "./hospitality-service";
import { getLocationByCode } from "./location-stock";
import { prisma } from "./prisma";

const TEST_PIN = "2491";

describe("HOSPITALITY PHASE 5.2 OPS", async () => {
  const waiter = await prisma.user.findFirst({ where: { role: "WAITER", active: true } });
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER", active: true } });
  const drink = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "BAR" } },
  });
  if (!waiter || !manager || !drink) {
    throw new Error("Need waiter, manager, and a tracked bar product.");
  }

  const waiterId = waiter.id;
  const managerId = manager.id;
  const drinkId = drink.id;
  const barLoc = await getLocationByCode(prisma, "BAR");
  const createdSessionIds: string[] = [];
  const occupiedTableIds: string[] = [];
  const createdTableIds: string[] = [];

  const stockSnapshot = await prisma.productLocationStock.findMany({
    where: { productId: drinkId },
  });
  const productSnapshot = await prisma.product.findUniqueOrThrow({
    where: { id: drinkId },
    select: { stockQuantity: true, sellingLocationId: true },
  });
  const pinSnapshot = await prisma.user.findUniqueOrThrow({
    where: { id: managerId },
    select: { pinHash: true, pinFailedAttempts: true, pinLockedUntil: true },
  });
  const settingsSnapshot = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: { receiptSequence: true },
  });

  async function stock() {
    return (
      (
        await prisma.productLocationStock.findUnique({
          where: { productId_locationId: { productId: drinkId, locationId: barLoc.id } },
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
    if (occupiedTableIds.length > 0) {
      await prisma.table.updateMany({
        where: { id: { in: occupiedTableIds } },
        data: { status: "AVAILABLE" },
      });
    }
    if (createdTableIds.length > 0) {
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
    const current = await prisma.productLocationStock.findMany({ where: { productId: drinkId } });
    for (const row of current) {
      if (!snapshotIds.has(row.id)) {
        await prisma.productLocationStock.delete({ where: { id: row.id } });
      }
    }
    for (const row of stockSnapshot) {
      await prisma.productLocationStock.update({ where: { id: row.id }, data: { quantity: row.quantity } });
    }
    await prisma.product.update({
      where: { id: drinkId },
      data: { stockQuantity: productSnapshot.stockQuantity, sellingLocationId: productSnapshot.sellingLocationId },
    });
  });

  async function track<T extends { id: string; tableId?: string | null }>(session: T) {
    createdSessionIds.push(session.id);
    if (session.tableId) occupiedTableIds.push(session.tableId);
    return session;
  }

  test("all six channels can open and keep destination/customer data after post", async () => {
    const before = await stock();
    const table = await prisma.table.create({
      data: { name: `T52-${Date.now()}`, status: "AVAILABLE", sortOrder: 9999 },
    });
    createdTableIds.push(table.id);

    const tableSession = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.TABLE, tableId: table.id }),
    );
    const walkIn = await track(await openServiceSession(waiterId, { channel: ServiceChannel.WALK_IN, customerName: "Walk Guest" }));
    const counter = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.COUNTER, destinationLabel: "Bar Seat 1" }),
    );
    const room = await track(
      await openServiceSession(waiterId, {
        channel: ServiceChannel.ACCOMMODATION,
        destinationLabel: "204",
        customerName: "Hotel Guest",
      }),
    );
    const delivery = await track(
      await openServiceSession(waiterId, {
        channel: ServiceChannel.DELIVERY,
        customerName: "Aline",
        customerPhone: "0780000000",
        deliveryAddress: "KN 4 Ave",
      }),
    );
    const takeaway = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.TAKEAWAY, destinationLabel: "Ticket 12", customerName: "Pickup" }),
    );

    assert.equal(await stock(), before);
    assert.equal((await prisma.table.findUniqueOrThrow({ where: { id: table.id } })).status, "OCCUPIED");
    assert.equal(tableSession.channel, ServiceChannel.TABLE);
    assert.equal(counter.destinationLabel, "Bar Seat 1");
    assert.equal(room.destinationLabel, "204");
    assert.equal(takeaway.destinationLabel, "Ticket 12");

    await postOrder(delivery.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const persisted = await prisma.serviceSession.findUniqueOrThrow({ where: { id: delivery.id } });
    assert.equal(persisted.customerName, "Aline");
    assert.equal(persisted.customerPhone, "0780000000");
    assert.equal(persisted.deliveryAddress, "KN 4 Ave");
    assert.equal(walkIn.customerName, "Walk Guest");
  });

  test("receipt shows split payments, channel, and waiter distinct from cashier", async () => {
    const session = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.COUNTER, destinationLabel: "Patio" }),
    );
    await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const sale = await finalizeSettlement(session.id, managerId, {
      idempotencyKey: randomUUID(),
      payments: [
        { method: PaymentMethod.CASH, amount: 800, cashReceived: 1000 },
        { method: PaymentMethod.MOBILE_MONEY, amount: 1200 },
      ],
    });
    const before = await stock();
    const receipt = await loadHospitalityReceipt(sale.id);
    assert.ok(receipt);
    assert.equal(receipt.channel, "COUNTER");
    assert.equal(receipt.destinationLabel, "Patio");
    assert.equal(receipt.waiterId, waiterId);
    assert.equal(receipt.cashierId, managerId);
    assert.notEqual(receipt.waiterId, receipt.cashierId);
    assert.equal(receipt.payments.length, 2);
    assert.equal(receipt.payments[0].method, "CASH");
    assert.equal(receipt.payments[0].cashReceived, 1000);
    assert.equal(receipt.payments[0].change, 200);
    assert.equal(receipt.payments[1].method, "MOBILE_MONEY");
    assert.equal(receipt.lines.reduce((sum, line) => sum + line.quantity, 0), 1);
    assert.equal(await stock(), before);
  });

  test("receipt shows credit and room charge without changing stock", async () => {
    const session = await track(
      await openServiceSession(waiterId, {
        channel: ServiceChannel.ACCOMMODATION,
        destinationLabel: "311",
        customerName: "Room Guest",
      }),
    );
    await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const sale = await finalizeSettlement(session.id, managerId, {
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: 2000,
      chargeToRoom: true,
      approvedById: managerId,
    });
    const before = await stock();
    const receipt = await loadHospitalityReceipt(sale.id);
    assert.ok(receipt);
    assert.equal(receipt.channel, "ACCOMMODATION");
    assert.equal(receipt.destinationLabel, "311");
    assert.equal(receipt.chargeToRoom, true);
    assert.equal(receipt.creditTotal, 2000);
    assert.equal(receipt.creditBalance, 2000);
    assert.equal(receipt.waiterId, waiterId);
    assert.equal(receipt.cashierId, managerId);
    assert.equal(await stock(), before);
  });

  test("fulfillment allows only sequential transitions and records history", async () => {
    const session = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.WALK_IN, destinationLabel: "Lounge" }),
    );
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const item = await prisma.sessionItem.findFirstOrThrow({ where: { roundId: round.id } });
    await assert.rejects(
      () => updateFulfillment(item.id, managerId, FulfillmentStatus.SERVED),
      (error: unknown) => error instanceof HospitalityError,
    );
    const before = await stock();
    await updateFulfillment(item.id, managerId, FulfillmentStatus.PREPARING);
    await assert.rejects(
      () => updateFulfillment(item.id, waiterId, FulfillmentStatus.POSTED),
      (error: unknown) => error instanceof HospitalityError,
    );
    await updateFulfillment(item.id, managerId, FulfillmentStatus.READY);
    await updateFulfillment(item.id, waiterId, FulfillmentStatus.SERVED);
    await assert.rejects(
      () => updateFulfillment(item.id, waiterId, FulfillmentStatus.READY),
      (error: unknown) => error instanceof HospitalityError,
    );
    const history = await prisma.sessionItemFulfillmentHistory.findMany({
      where: { sessionItemId: item.id },
      orderBy: { timestamp: "asc" },
    });
    assert.equal(history.length, 3);
    assert.deepEqual(history.map((row) => row.status), [
      FulfillmentStatus.PREPARING,
      FulfillmentStatus.READY,
      FulfillmentStatus.SERVED,
    ]);
    assert.equal(history[2].staffId, waiterId);
    assert.equal(await stock(), before);
  });

  test("round poster stays the original poster after handover", async () => {
    const targetWaiter =
      (await prisma.user.findFirst({ where: { role: "WAITER", active: true, NOT: { id: waiterId } } })) ??
      (await prisma.user.findFirst({ where: { role: "BILLIARD", active: true, NOT: { id: waiterId } } }));
    if (!targetWaiter) throw new Error("Need a second staff user for handover tests.");
    const session = await track(
      await openServiceSession(waiterId, { channel: ServiceChannel.COUNTER, destinationLabel: "Counter 3" }),
    );
    const round = await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    await processHandover(session.id, targetWaiter.id, managerId, "Break");
    const current = await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } });
    const persistedRound = await prisma.orderRound.findUniqueOrThrow({ where: { id: round.id } });
    assert.equal(current.waiterId, targetWaiter.id);
    assert.equal(persistedRound.postedById, waiterId);
    assert.notEqual(persistedRound.postedById, current.waiterId);
  });

  test("reports read payments and postedBy without changing stock", async () => {
    const before = await stock();
    const report = await loadHospitalityReport(new Date(Date.now() - 86400000), new Date(Date.now() + 86400000));
    const cash = report.paymentTotals.get("CASH");
    const mobile = report.paymentTotals.get("MOBILE_MONEY");
    assert.ok((cash?.amount ?? 0) + (mobile?.amount ?? 0) >= 2000);
    assert.ok(report.postedBy.get(waiterId));
    assert.ok((report.channelTotals.get("COUNTER")?.count ?? 0) >= 1);
    assert.ok((report.channelTotals.get("ACCOMMODATION")?.count ?? 0) >= 1);
    assert.equal(await stock(), before);
  });
});
