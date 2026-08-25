import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { hash } from "bcryptjs";
import { CreditStatus, PaymentMethod, ServiceChannel, SessionStatus, StaffActionType } from "@prisma/client";
import { getLocationByCode } from "./location-stock";
import { verifyManagerApproval } from "./manager-approval";
import {
  HospitalityError,
  finalizeSettlement,
  postOrder,
  recordCreditPayment,
} from "./hospitality-service";
import { prisma } from "./prisma";

const TEST_PIN = "2491";

describe("HOSPITALITY SETTLEMENT AND CREDIT", async () => {
  const waiter = await prisma.user.findFirst({ where: { role: "WAITER", active: true } });
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER", active: true } });
  const drink = await prisma.product.findFirst({
    where: { trackInventory: true, sellingLocation: { code: "BAR" } },
  });
  if (!waiter || !manager || !drink) {
    throw new Error("Need waiter, manager, and a tracked bar product.");
  }

  const waiterId = waiter.id;
  const waiterRole = waiter.role;
  const managerId = manager.id;
  const drinkId = drink.id;
  const barLoc = await getLocationByCode(prisma, "BAR");
  const createdSessionIds: string[] = [];

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
    await prisma.user.update({ where: { id: managerId }, data: pinSnapshot });
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

  async function createSession(
    channel: ServiceChannel = ServiceChannel.TABLE,
    extra: { destinationLabel?: string; customerName?: string } = {},
  ) {
    const session = await prisma.serviceSession.create({
      data: {
        channel,
        waiterId,
        status: SessionStatus.ACTIVE,
        destinationLabel: extra.destinationLabel,
        customerName: extra.customerName,
      },
    });
    createdSessionIds.push(session.id);
    return session;
  }

  async function postedSession(quantity = 1) {
    const session = await createSession();
    await postOrder(session.id, waiterId, [{ productId: drinkId, quantity, unitPrice: 2000 }]);
    return session;
  }

  async function managerIdVerified() {
    const approved = await verifyManagerApproval({
      managerUserId: managerId,
      managerPin: TEST_PIN,
      requesterId: waiterId,
      requesterRole: waiterRole,
      allowSelfApproval: false,
      action: "CREDIT",
    });
    return approved.id;
  }

  test("ACTIVE to CLOSED settlement records history and cashier", async () => {
    const session = await postedSession();
    const sale = await finalizeSettlement(session.id, managerId, {
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: 2000, cashReceived: 2000 }],
    });
    const closed = await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(closed.status, SessionStatus.CLOSED);
    assert.equal(closed.waiterId, waiterId);
    assert.equal(sale.cashierId, managerId);
    assert.notEqual(sale.cashierId, closed.waiterId);
    const history = await prisma.sessionStaffHistory.findMany({
      where: { sessionId: session.id, action: { in: [StaffActionType.SETTLEMENT_REQUESTED, StaffActionType.SETTLED] } },
    });
    assert.equal(history.filter((row) => row.action === StaffActionType.SETTLEMENT_REQUESTED).length, 1);
    assert.equal(history.filter((row) => row.action === StaffActionType.SETTLED).length, 1);
    assert.ok(history.every((row) => row.staffId === managerId));
  });

  test("failed settlement leaves the session usable", async () => {
    const session = await postedSession();
    await assert.rejects(
      () =>
        finalizeSettlement(session.id, waiterId, {
          idempotencyKey: randomUUID(),
          payments: [{ method: PaymentMethod.CASH, amount: 1500 }],
        }),
      (error: unknown) => error instanceof HospitalityError,
    );
    const current = await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(current.status, SessionStatus.ACTIVE);
    assert.equal(await prisma.sale.count({ where: { sessionId: session.id } }), 0);
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: 2000 }],
    });
    assert.ok(sale.id);
  });

  test("split payment success", async () => {
    const session = await postedSession(1);
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [
        { method: PaymentMethod.CASH, amount: 500 },
        { method: PaymentMethod.MOBILE_MONEY, amount: 1500 },
      ],
    });
    assert.equal(sale.payments.length, 2);
    assert.equal(Number(sale.amountPaid), 2000);
    assert.equal(Number(sale.total), 2000);
  });

  test("overpayment is rejected and creates no sale", async () => {
    const session = await postedSession();
    await assert.rejects(
      () =>
        finalizeSettlement(session.id, waiterId, {
          idempotencyKey: randomUUID(),
          payments: [{ method: PaymentMethod.CASH, amount: 2500 }],
        }),
      (error: unknown) => error instanceof HospitalityError && error.message.includes("exceeds"),
    );
    assert.equal(await prisma.sale.count({ where: { sessionId: session.id } }), 0);
    assert.equal((await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } })).status, SessionStatus.ACTIVE);
  });

  test("underpayment is rejected unless converted to credit", async () => {
    const session = await postedSession();
    await assert.rejects(
      () =>
        finalizeSettlement(session.id, waiterId, {
          idempotencyKey: randomUUID(),
          payments: [{ method: PaymentMethod.CASH, amount: 800 }],
        }),
      (error: unknown) => error instanceof HospitalityError,
    );
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: 800 }],
      creditAmount: 1200,
      customerName: "Guest Credit",
      approvedById: await managerIdVerified(),
    });
    assert.equal(sale.creditBill?.status, CreditStatus.OUTSTANDING);
    assert.equal(Number(sale.creditBill?.balance), 1200);
    assert.equal(Number(sale.amountPaid), 800);
    assert.equal(sale.creditBill?.approvedById, managerId);
  });

  test("credit requires manager authorization", async () => {
    const session = await postedSession();
    await assert.rejects(
      () =>
        finalizeSettlement(session.id, waiterId, {
          idempotencyKey: randomUUID(),
          payments: [],
          creditAmount: 2000,
          customerName: "No Manager",
        }),
      (error: unknown) => error instanceof HospitalityError && error.message.includes("Manager approval"),
    );
  });

  test("accommodation charge to room creates outstanding credit", async () => {
    const session = await createSession(ServiceChannel.ACCOMMODATION, {
      destinationLabel: "204",
      customerName: "Room Guest",
    });
    await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: 2000,
      chargeToRoom: true,
      approvedById: await managerIdVerified(),
    });
    assert.equal(sale.creditBill?.status, CreditStatus.OUTSTANDING);
    assert.equal(sale.creditBill?.sessionId, session.id);
    assert.equal(sale.creditBill?.customerName, "Room Guest");
    assert.equal(sale.payments.length, 0);
    assert.equal((await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } })).status, SessionStatus.CLOSED);
  });

  test("credit payment lifecycle and overpayment rejection", async () => {
    const session = await postedSession();
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: 2000,
      customerName: "Tab Guest",
      approvedById: await managerIdVerified(),
    });
    const billId = sale.creditBill!.id;
    const first = await recordCreditPayment(billId, waiterId, {
      amount: 700,
      method: PaymentMethod.CASH,
      idempotencyKey: randomUUID(),
    });
    assert.equal(first.creditBill.status, CreditStatus.PARTIALLY_PAID);
    assert.equal(Number(first.creditBill.balance), 1300);
    assert.equal(first.receivedById, waiterId);

    await assert.rejects(
      () =>
        recordCreditPayment(billId, waiterId, {
          amount: 5000,
          method: PaymentMethod.CASH,
          idempotencyKey: randomUUID(),
        }),
      (error: unknown) => error instanceof HospitalityError && error.message.includes("exceeds"),
    );

    const second = await recordCreditPayment(billId, waiterId, {
      amount: 1300,
      method: PaymentMethod.MOBILE_MONEY,
      idempotencyKey: randomUUID(),
    });
    assert.equal(second.creditBill.status, CreditStatus.PAID);
    assert.equal(Number(second.creditBill.balance), 0);
  });

  test("duplicate settlement idempotency returns the same sale", async () => {
    const session = await postedSession();
    const key = randomUUID();
    const first = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: key,
      payments: [{ method: PaymentMethod.CARD, amount: 2000 }],
    });
    const second = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: key,
      payments: [{ method: PaymentMethod.CARD, amount: 2000 }],
    });
    assert.equal(first.id, second.id);
    assert.equal(await prisma.sale.count({ where: { sessionId: session.id } }), 1);
  });

  test("concurrent settlement creates only one sale", async () => {
    const session = await postedSession();
    const results = await Promise.allSettled([
      finalizeSettlement(session.id, waiterId, {
        idempotencyKey: randomUUID(),
        payments: [{ method: PaymentMethod.CASH, amount: 2000 }],
      }),
      finalizeSettlement(session.id, waiterId, {
        idempotencyKey: randomUUID(),
        payments: [{ method: PaymentMethod.MOBILE_MONEY, amount: 2000 }],
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await prisma.sale.count({ where: { sessionId: session.id } }), 1);
    assert.equal(await prisma.payment.count({ where: { sale: { sessionId: session.id } } }), 1);
    assert.equal(await prisma.creditBill.count({ where: { sessionId: session.id } }), 0);
  });

  test("credit payment idempotency", async () => {
    const session = await postedSession();
    const sale = await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: 2000,
      customerName: "Retry Guest",
      approvedById: await managerIdVerified(),
    });
    const key = randomUUID();
    const first = await recordCreditPayment(sale.creditBill!.id, waiterId, {
      amount: 2000,
      method: PaymentMethod.CASH,
      idempotencyKey: key,
    });
    const second = await recordCreditPayment(sale.creditBill!.id, waiterId, {
      amount: 2000,
      method: PaymentMethod.CASH,
      idempotencyKey: key,
    });
    assert.equal(first.id, second.id);
    assert.equal(await prisma.creditPayment.count({ where: { creditBillId: sale.creditBill!.id } }), 1);
  });

  test("settlement does not change inventory or create movements", async () => {
    const session = await postedSession(2);
    const locationBefore = await stock();
    const productBefore = await prisma.product.findUniqueOrThrow({
      where: { id: drinkId },
      select: { stockQuantity: true },
    });
    const movementsBefore = await prisma.inventoryMovement.count();
    await finalizeSettlement(session.id, waiterId, {
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: 4000 }],
    });
    assert.equal(await stock(), locationBefore);
    const productAfter = await prisma.product.findUniqueOrThrow({
      where: { id: drinkId },
      select: { stockQuantity: true },
    });
    assert.equal(productAfter.stockQuantity, productBefore.stockQuantity);
    assert.equal(await prisma.inventoryMovement.count(), movementsBefore);
  });

  test("failed transaction leaves no orphan financial records", async () => {
    const session = await postedSession();
    const salesBefore = await prisma.sale.count();
    const paymentsBefore = await prisma.payment.count();
    const creditsBefore = await prisma.creditBill.count();
    const approvedById = await managerIdVerified();
    await assert.rejects(() =>
      finalizeSettlement(session.id, waiterId, {
        idempotencyKey: randomUUID(),
        payments: [{ method: PaymentMethod.CASH, amount: 2000 }],
        creditAmount: 500,
        customerName: "Too Much",
        approvedById,
      }),
    );
    assert.equal(await prisma.sale.count(), salesBefore);
    assert.equal(await prisma.payment.count(), paymentsBefore);
    assert.equal(await prisma.creditBill.count(), creditsBefore);
    assert.equal((await prisma.serviceSession.findUniqueOrThrow({ where: { id: session.id } })).status, SessionStatus.ACTIVE);
  });

  test("charge to room without destination is rejected", async () => {
    const session = await createSession(ServiceChannel.ACCOMMODATION, { customerName: "No Room" });
    await postOrder(session.id, waiterId, [{ productId: drinkId, quantity: 1, unitPrice: 2000 }]);
    const approvedById = await managerIdVerified();
    await assert.rejects(
      () =>
        finalizeSettlement(session.id, waiterId, {
          idempotencyKey: randomUUID(),
          payments: [],
          creditAmount: 2000,
          chargeToRoom: true,
          approvedById,
        }),
      (error: unknown) => error instanceof HospitalityError && error.message.includes("destination"),
    );
  });
});
