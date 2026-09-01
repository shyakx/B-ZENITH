import { loadEnvConfig } from "@next/env";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/services/orders";
import { listOpenOrdersByTable } from "@/services/orders";
import { markPayLater, recordPayment, recordTablePayment, settleCredit } from "@/services/payments";
import { createIsolatedPosProduct, cleanupInventoryArtifacts } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
const createdTableIds: string[] = [];
let productId = "";
let categoryId = "";

beforeAll(async () => {
  const isolated = await createIsolatedPosProduct({ sellingPrice: 2000, barQuantity: 50 });
  productId = isolated.product.id;
  categoryId = isolated.category.id;
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: createdOrderIds } },
      select: { id: true, orderNumber: true },
    });
    const credits = await prisma.creditRecord.findMany({
      where: { orderId: { in: createdOrderIds } },
      select: { id: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...createdOrderIds, ...credits.map((credit) => credit.id)] } },
    });
    await prisma.creditRecord.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { reference: { in: numbers } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (createdTableIds.length > 0) {
    await prisma.serviceTable.deleteMany({ where: { id: { in: createdTableIds } } });
  }
  if (productId) {
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
    await cleanupInventoryArtifacts([productId]);
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  if (categoryId) {
    await prisma.category.deleteMany({ where: { id: categoryId } });
  }
  await prisma.$disconnect();
});

describe("cashier payments against the database", () => {
  it("keeps waiter names, allocates table cash, pay later, settle, and rejects unsafe amounts", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-PAY-${Date.now()}`, sortOrder: 9001 },
    });
    createdTableIds.push(table.id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!john || !mary || !grace || !product) {
      throw new Error("Seed data is required (John, Mary, Grace).");
    }

    expect(hasPermission("CASHIER", "createOrder")).toBe(false);
    expect(hasPermission("CASHIER", "manageProducts")).toBe(false);
    expect(hasPermission("CASHIER", "manageInventory")).toBe(false);
    expect(hasPermission("CASHIER", "recordPayment")).toBe(true);

    const stamp = Date.now();
    const johnOrder = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 2 }],
      idempotencyKey: `test-cash-john-${stamp}`,
    });
    const maryOrder = await createOrder({
      waiterId: mary.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 3 }],
      idempotencyKey: `test-cash-mary-${stamp}`,
    });
    createdOrderIds.push(johnOrder.id, maryOrder.id);

    expect(johnOrder.total).toBe(4000);
    expect(maryOrder.total).toBe(6000);
    expect(johnOrder.waiter.name).toBe("John");
    expect(maryOrder.waiter.name).toBe("Mary");

    const groups = await listOpenOrdersByTable();
    const table7 = groups.find((group) => group.tableId === table.id);
    expect(table7?.orders.map((order) => order.id).sort()).toEqual([johnOrder.id, maryOrder.id].sort());
    expect(table7?.orders.map((order) => order.waiter.name).sort()).toEqual(["John", "Mary"]);

    const partial = await recordPayment({
      orderId: johnOrder.id,
      amount: 1000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-partial-${stamp}`,
    });
    expect(partial.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(partial.paidAmount).toBe(1000);
    expect(partial.total - partial.paidAmount).toBe(3000);

    const paid = await recordPayment({
      orderId: johnOrder.id,
      amount: 3000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-full-${stamp}`,
    });
    expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
    expect(paid.paidAmount).toBe(4000);

    const maryPaid = await recordPayment({
      orderId: maryOrder.id,
      amount: 6000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-mary-full-${stamp}`,
    });
    expect(maryPaid.paymentStatus).toBe(PaymentStatus.PAID);

    const laterA = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 2 }],
      idempotencyKey: `test-cash-table-a-${stamp}`,
    });
    const laterB = await createOrder({
      waiterId: mary.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 3 }],
      idempotencyKey: `test-cash-table-b-${stamp}`,
    });
    createdOrderIds.push(laterA.id, laterB.id);

    const tablePay = await recordTablePayment({
      tableId: table.id,
      amount: 5000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-table-${stamp}`,
    });
    expect(tablePay.amount).toBe(5000);
    expect(tablePay.allocations[0]).toMatchObject({
      orderId: laterA.id,
      amount: 4000,
      remaining: 0,
      paymentStatus: PaymentStatus.PAID,
    });
    expect(tablePay.allocations[1]).toMatchObject({
      orderId: laterB.id,
      amount: 1000,
      remaining: 5000,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
    });
    expect(tablePay.remaining).toBe(5000);

    const replay = await recordTablePayment({
      tableId: table.id,
      amount: 5000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-table-${stamp}`,
    });
    expect(replay.amount).toBe(5000);
    const laterBAfterReplay = await prisma.order.findUnique({ where: { id: laterB.id } });
    expect(laterBAfterReplay?.paidAmount).toBe(1000);

    const creditOrder = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `test-cash-later-${stamp}`,
    });
    createdOrderIds.push(creditOrder.id);

    const payLater = await markPayLater({
      orderId: creditOrder.id,
      customerName: "Alain",
      customerPhone: "0780000000",
      cashierId: grace.id,
    });
    expect(payLater.paymentStatus).toBe(PaymentStatus.PAY_LATER);
    const cashForLater = await prisma.payment.findMany({ where: { orderId: creditOrder.id } });
    expect(cashForLater).toHaveLength(0);

    const credit = await prisma.creditRecord.findUnique({ where: { orderId: creditOrder.id } });
    expect(credit?.amountOwed).toBe(2000);
    expect(credit?.settled).toBe(false);

    const settled = await settleCredit({
      creditId: credit!.id,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-settle-${stamp}`,
    });
    expect(settled.paymentStatus).toBe(PaymentStatus.PAID);
    const cashAfterSettle = await prisma.payment.findMany({ where: { orderId: creditOrder.id } });
    expect(cashAfterSettle).toHaveLength(1);
    expect(cashAfterSettle[0]?.amount).toBe(2000);
    expect(cashAfterSettle[0]?.cashierId).toBe(grace.id);

    const over = await createOrder({
      waiterId: mary.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `test-cash-over-${stamp}`,
    });
    createdOrderIds.push(over.id);
    await expect(
      recordPayment({
        orderId: over.id,
        amount: 3000,
        method: PaymentMethod.CASH,
        cashierId: grace.id,
        idempotencyKey: `test-cash-overpay-${stamp}`,
      }),
    ).rejects.toThrow(/larger/);
    const stillUnpaid = await prisma.order.findUnique({ where: { id: over.id } });
    expect(stillUnpaid?.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(stillUnpaid?.paidAmount).toBe(0);

    const first = await recordPayment({
      orderId: over.id,
      amount: 2000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-dup-${stamp}`,
    });
    const second = await recordPayment({
      orderId: over.id,
      amount: 2000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-cash-dup-${stamp}`,
    });
    expect(second.paidAmount).toBe(first.paidAmount);
    const payments = await prisma.payment.findMany({ where: { orderId: over.id } });
    expect(payments).toHaveLength(1);

    const audits = await prisma.auditLog.findMany({
      where: {
        userId: grace.id,
        action: { in: ["PAYMENT_RECORDED", "PAY_LATER_CREATED", "PAY_LATER_SETTLED"] },
        entityId: { in: [...createdOrderIds, credit!.id] },
      },
    });
    expect(audits.some((row) => row.action === "PAYMENT_RECORDED")).toBe(true);
    expect(audits.some((row) => row.action === "PAY_LATER_CREATED")).toBe(true);
    expect(audits.some((row) => row.action === "PAY_LATER_SETTLED")).toBe(true);
  });
});
