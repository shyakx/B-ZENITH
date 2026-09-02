import { loadEnvConfig } from "@next/env";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { endOfDay, rwandaDayRange, startOfDay } from "@/lib/dates";
import { currentOutstandingAmount, reconcileTodaySales } from "@/lib/manager-dashboard";
import { prisma } from "@/lib/prisma";
import { createMaisonRecord, recordMaisonPayment } from "@/services/maison";
import { cancelOrder, createOrder, payableOutstandingBalance, todayLiveOrderTotals, waiterTodaySnapshot } from "@/services/orders";
import { markPayLater, recordPayment, settleCredit, sumPaymentsReceived, unsettledCreditTotal } from "@/services/payments";
import { salesSummary } from "@/services/reports";
import { cleanupInventoryArtifacts, createIsolatedPosProduct } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
const createdTableIds: string[] = [];
const createdMaisonIds: string[] = [];
let productId = "";
let categoryId = "";
let zeroProductId = "";
let zeroCategoryId = "";

async function allUnpaidNow() {
  return currentOutstandingAmount([{ total: await payableOutstandingBalance(), paidAmount: 0 }], [
    { amountOwed: await unsettledCreditTotal() },
  ]);
}

async function paymentSum(orderId: string) {
  const payments = await prisma.payment.findMany({ where: { orderId } });
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

beforeAll(async () => {
  const isolated = await createIsolatedPosProduct({ sellingPrice: 20000, barQuantity: 80 });
  productId = isolated.product.id;
  categoryId = isolated.category.id;
  const zero = await createIsolatedPosProduct({ sellingPrice: 0, barQuantity: 10 });
  zeroProductId = zero.product.id;
  zeroCategoryId = zero.category.id;
});

afterAll(async () => {
  if (createdMaisonIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdMaisonIds } } });
    await prisma.maisonRecord.deleteMany({ where: { id: { in: createdMaisonIds } } });
  }
  const tableOrders =
    createdTableIds.length > 0
      ? await prisma.order.findMany({
          where: { tableId: { in: createdTableIds } },
          select: { id: true, orderNumber: true },
        })
      : [];
  const orderIds = [...new Set([...createdOrderIds, ...tableOrders.map((order) => order.id)])];
  if (orderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true },
    });
    const credits = await prisma.creditRecord.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...orderIds, ...credits.map((credit) => credit.id)] } },
    });
    await prisma.creditRecord.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { reference: { in: numbers } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (createdTableIds.length > 0) {
    await prisma.serviceTable.deleteMany({ where: { id: { in: createdTableIds } } });
  }
  for (const id of [productId, zeroProductId]) {
    if (id) {
      await prisma.inventoryMovement.deleteMany({ where: { productId: id } });
      await cleanupInventoryArtifacts([id]);
      await prisma.product.deleteMany({ where: { id } });
    }
  }
  for (const id of [categoryId, zeroCategoryId]) {
    if (id) await prisma.category.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe("financial reconciliation (existing behavior, not a redesign)", () => {
  it("keeps Order.paidAmount equal to the sum of Payment rows after multiple payments", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-${Date.now()}`, sortOrder: 9101 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-full-${stamp}`,
    });
    createdOrderIds.push(order.id);
    expect(order.total).toBe(20000);

    await recordPayment({
      orderId: order.id,
      amount: 5000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-p1-${stamp}`,
    });
    await recordPayment({
      orderId: order.id,
      amount: 7000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-p2-${stamp}`,
    });
    const paid = await recordPayment({
      orderId: order.id,
      amount: 8000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-p3-${stamp}`,
    });

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    const sum = payments.reduce((total, payment) => total + payment.amount, 0);
    const balance = stored!.total - stored!.paidAmount;

    expect(stored!.paidAmount).toBe(20000);
    expect(sum).toBe(20000);
    expect(stored!.paidAmount).toBe(sum);
    expect(balance).toBe(0);
    expect(stored!.total).toBe(stored!.paidAmount + balance);
    expect(stored!.paymentStatus).toBe(PaymentStatus.PAID);
    expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
    expect(payments).toHaveLength(3);
  });

  it("reconciles partial payments: paid + balance = total", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-P-${Date.now()}`, sortOrder: 9102 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-partial-${stamp}`,
    });
    createdOrderIds.push(order.id);

    await recordPayment({
      orderId: order.id,
      amount: 5000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-part1-${stamp}`,
    });
    const after = await recordPayment({
      orderId: order.id,
      amount: 7000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-part2-${stamp}`,
    });

    const paidAmount = after.paidAmount;
    const balance = after.total - after.paidAmount;
    expect(paidAmount).toBe(12000);
    expect(balance).toBe(8000);
    expect(paidAmount + balance).toBe(after.total);
    expect(paidAmount).toBe(await paymentSum(order.id));
    expect(after.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
  });

  it("does not create a Payment when an order is marked pay later", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-L-${Date.now()}`, sortOrder: 9103 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-later-${stamp}`,
    });
    createdOrderIds.push(order.id);

    const later = await markPayLater({
      orderId: order.id,
      customerName: "Credit Test",
      cashierId: grace.id,
    });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    const credit = await prisma.creditRecord.findUnique({ where: { orderId: order.id } });
    const stored = await prisma.order.findUnique({ where: { id: order.id } });

    expect(later.paymentStatus).toBe(PaymentStatus.PAY_LATER);
    expect(stored!.paidAmount).toBe(0);
    expect(payments).toHaveLength(0);
    expect(credit).not.toBeNull();
    expect(credit!.settled).toBe(false);
    expect(credit!.amountOwed).toBe(20000);
    expect(stored!.total - stored!.paidAmount).toBe(stored!.total);
  });

  it("creates a real Payment when customer credit is settled", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-S-${Date.now()}`, sortOrder: 9104 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-settle-${stamp}`,
    });
    createdOrderIds.push(order.id);

    await markPayLater({
      orderId: order.id,
      customerName: "Settle Test",
      cashierId: grace.id,
    });
    const credit = await prisma.creditRecord.findUnique({ where: { orderId: order.id } });
    const before = await prisma.order.findUnique({ where: { id: order.id } });
    expect(before!.paidAmount).toBe(0);

    const settled = await settleCredit({
      creditId: credit!.id,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-settle-pay-${stamp}`,
    });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    const afterCredit = await prisma.creditRecord.findUnique({ where: { id: credit!.id } });
    const balance = settled.total - settled.paidAmount;

    expect(payments).toHaveLength(1);
    expect(payments[0]!.amount).toBe(20000);
    expect(settled.paidAmount).toBe(20000);
    expect(settled.paidAmount).toBe(await paymentSum(order.id));
    expect(balance).toBe(0);
    expect(afterCredit!.settled).toBe(true);
    expect(settled.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it("treats an old order paid today as cash today, not today's sales", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const from = startOfDay();
    const to = endOfDay();
    const yesterday = rwandaDayRange(new Date(from.getTime() - 1));
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-OLD-${Date.now()}`, sortOrder: 9105 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-old-${stamp}`,
    });
    createdOrderIds.push(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { createdAt: yesterday.from },
    });

    const inTodaySales = () =>
      prisma.order.count({
        where: {
          id: order.id,
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
        },
      });

    expect(await inTodaySales()).toBe(0);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.paidAmount).toBe(0);

    await recordPayment({
      orderId: order.id,
      amount: 20000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-fin-old-pay-${stamp}`,
    });

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    expect(payment).not.toBeNull();
    expect(payment!.amount).toBe(20000);
    expect(payment!.method).toBe(PaymentMethod.CASH);
    expect(payment!.createdAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(payment!.createdAt.getTime()).toBeLessThanOrEqual(to.getTime());
    expect(await sumPaymentsReceived(from, to, PaymentMethod.CASH)).toBeGreaterThanOrEqual(20000);

    expect(await inTodaySales()).toBe(0);
    const todayPopulation = await prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { id: true, total: true, paidAmount: true },
    });
    expect(todayPopulation.some((row) => row.id === order.id)).toBe(false);
    const live = await todayLiveOrderTotals(from, to);
    expect(live).toEqual(reconcileTodaySales(todayPopulation));
    expect(live.salesToday).toBe(live.paidToday + live.outstanding);

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored!.paidAmount).toBe(20000);
    expect(stored!.total - stored!.paidAmount).toBe(0);
    expect(stored!.paymentStatus).toBe(PaymentStatus.PAID);
    expect(
      await prisma.order.count({
        where: {
          id: order.id,
          status: { not: OrderStatus.CANCELLED },
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
        },
      }),
    ).toBe(0);
  });

  it("excludes a cancelled unpaid order from live sales and rejects payment", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const from = startOfDay();
    const to = endOfDay();
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-C-${Date.now()}`, sortOrder: 9106 },
    });
    createdTableIds.push(table.id);
    const stamp = Date.now();

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-cancel-${stamp}`,
    });
    createdOrderIds.push(order.id);

    const cancelled = await cancelOrder({ orderId: order.id, userId: grace.id });
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe(OrderStatus.CANCELLED);
    expect(
      await prisma.order.count({
        where: {
          id: order.id,
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ).toBe(0);

    const live = await todayLiveOrderTotals(from, to);
    expect(live.salesToday).toBe(live.paidToday + live.outstanding);

    await expect(
      recordPayment({
        orderId: order.id,
        amount: 20000,
        method: PaymentMethod.CASH,
        cashierId: grace.id,
        idempotencyKey: `test-fin-cancel-pay-${stamp}`,
      }),
    ).rejects.toThrow(/cancelled/);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("keeps reports All unpaid now all-time even when the order is outside From/To", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    if (!john) throw new Error("Seed data is required (John).");

    const today = rwandaDayRange();
    const yesterday = rwandaDayRange(new Date(today.from.getTime() - 1));
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-R-${Date.now()}`, sortOrder: 9107 },
    });
    createdTableIds.push(table.id);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-range-${Date.now()}`,
    });
    createdOrderIds.push(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { createdAt: yesterday.from },
    });

    expect(
      await prisma.order.count({
        where: {
          id: order.id,
          createdAt: { gte: today.from, lte: today.to },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ).toBe(0);

    const payable = await prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
      },
      select: { id: true, total: true, paidAmount: true },
    });
    const ours = payable.find((row) => row.id === order.id);
    expect(ours).toBeDefined();
    expect(ours!.total - ours!.paidAmount).toBe(20000);
    expect(await allUnpaidNow()).toBeGreaterThanOrEqual(20000);

    const periodOpen = await prisma.order.findMany({
      where: {
        createdAt: { gte: today.from, lte: today.to },
        status: { not: OrderStatus.CANCELLED },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID, PaymentStatus.PAY_LATER] },
      },
      select: { id: true },
    });
    expect(periodOpen.some((row) => row.id === order.id)).toBe(false);
    await salesSummary(today.from, today.to);
  });

  it("does not add Maison money to POS sales or POS payments", async () => {
    const manager = await prisma.user.findFirst({ where: { role: "MANAGER", active: true } });
    if (!manager) throw new Error("Seed data is required (an active Manager).");

    const from = startOfDay();
    const to = endOfDay();
    const amount = 41237;

    const record = await createMaisonRecord({
      customerName: `Maison POS check ${Date.now()}`,
      date: new Date(),
      amount,
      paidAmount: 0,
      staffId: manager.id,
    });
    createdMaisonIds.push(record.id);
    await recordMaisonPayment({ id: record.id, amount, staffId: manager.id });

    expect(await prisma.payment.findFirst({ where: { amount } })).toBeNull();
    expect(await prisma.order.findFirst({ where: { total: amount } })).toBeNull();
    const live = await todayLiveOrderTotals(from, to);
    expect(live.salesToday).toBe(live.paidToday + live.outstanding);
    const summary = await salesSummary(from, to);
    expect(summary.paidSales).not.toBe(amount);

    const stored = await prisma.maisonRecord.findUnique({ where: { id: record.id } });
    expect(stored!.paidAmount).toBe(amount);
    expect(stored!.amount).toBe(amount);
  });

  it("counts cancelled orders in the waiter today snapshot (current query, not a product change)", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const from = startOfDay();
    const to = endOfDay();
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-W-${Date.now()}`, sortOrder: 9108 },
    });
    createdTableIds.push(table.id);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-fin-waiter-${Date.now()}`,
    });
    createdOrderIds.push(order.id);
    await cancelOrder({ orderId: order.id, userId: grace.id });

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored!.status).toBe(OrderStatus.CANCELLED);
    expect(stored!.createdAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(stored!.createdAt.getTime()).toBeLessThanOrEqual(to.getTime());
    expect(
      await prisma.order.count({
        where: { waiterId: john.id, createdAt: { gte: from, lte: to }, id: order.id },
      }),
    ).toBe(1);
    const snapshot = await waiterTodaySnapshot(john.id, from, to);
    expect(snapshot.length).toBeGreaterThanOrEqual(1);
  });

  it("documents current zero-value order behavior without adding a policy", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    if (!john || !grace) throw new Error("Seed data is required (John, Grace).");

    const from = startOfDay();
    const to = endOfDay();
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-FIN-Z-${Date.now()}`, sortOrder: 9109 },
    });
    createdTableIds.push(table.id);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: zeroProductId, quantity: 1 }],
      idempotencyKey: `test-fin-zero-${Date.now()}`,
    });
    createdOrderIds.push(order.id);

    expect(order.total).toBe(0);
    expect(order.paidAmount).toBe(0);
    expect(order.total - order.paidAmount).toBe(0);
    expect(order.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(
      await prisma.order.count({
        where: {
          id: order.id,
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ).toBe(1);

    const after = await todayLiveOrderTotals(from, to);
    expect(after.salesToday).toBe(after.paidToday + after.outstanding);

    await expect(
      recordPayment({
        orderId: order.id,
        amount: 1,
        method: PaymentMethod.CASH,
        cashierId: grace.id,
        idempotencyKey: `test-fin-zero-pay-${Date.now()}`,
      }),
    ).rejects.toThrow(/already paid/);
  });
});
