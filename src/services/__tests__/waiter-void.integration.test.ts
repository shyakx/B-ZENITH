import { loadEnvConfig } from "@next/env";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOrder, createOrder } from "@/services/orders";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
let heinekenId = "";
let startingStock = 0;

beforeAll(async () => {
  const heineken = await prisma.product.findFirst({ where: { name: "Heineken", active: true } });
  if (heineken) {
    heinekenId = heineken.id;
    startingStock = heineken.stockQuantity;
  }
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: createdOrderIds } },
      select: { id: true, orderNumber: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.inventoryMovement.deleteMany({ where: { reference: { in: numbers } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (heinekenId) {
    await prisma.product.update({
      where: { id: heinekenId },
      data: { stockQuantity: startingStock },
    });
  }
  await prisma.$disconnect();
});

describe("waiter void + order again against the database", () => {
  it("voids own unpaid order, restores stock, keeps history, and replacement gets a new number", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
    const table = await prisma.serviceTable.findFirst({ where: { active: true } });
    const heineken = await prisma.product.findUnique({ where: { id: heinekenId } });
    if (!john || !mary || !table || !heineken) {
      throw new Error("Seed data is required for this test (John, Mary, a table, Heineken).");
    }

    const first = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: heineken.id, quantity: 5 }],
      idempotencyKey: `test-void-first-${Date.now()}`,
    });
    createdOrderIds.push(first.id);

    const afterSale = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(afterSale?.stockQuantity).toBe(startingStock - 5);

    await expect(
      cancelOrder({ orderId: first.id, userId: mary.id, ownerWaiterId: mary.id }),
    ).rejects.toThrow("You can only void your own orders.");

    const stillOpen = await prisma.order.findUnique({ where: { id: first.id } });
    expect(stillOpen?.status).toBe(OrderStatus.OPEN);
    const stockAfterFailedTheft = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(stockAfterFailedTheft?.stockQuantity).toBe(startingStock - 5);

    const voided = await cancelOrder({
      orderId: first.id,
      userId: john.id,
      ownerWaiterId: john.id,
    });
    expect(voided.status).toBe(OrderStatus.CANCELLED);
    expect(voided.orderNumber).toBe(first.orderNumber);

    const history = await prisma.order.findUnique({ where: { id: first.id } });
    expect(history).not.toBeNull();
    expect(history?.status).toBe(OrderStatus.CANCELLED);
    expect(history?.orderNumber).toBe(first.orderNumber);

    const afterVoid = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(afterVoid?.stockQuantity).toBe(startingStock);

    await expect(
      cancelOrder({ orderId: first.id, userId: john.id, ownerWaiterId: john.id }),
    ).rejects.toThrow("This order is already cancelled.");
    const afterDuplicate = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(afterDuplicate?.stockQuantity).toBe(startingStock);

    const second = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: heineken.id, quantity: 2 }],
      idempotencyKey: `test-void-second-${Date.now()}`,
    });
    createdOrderIds.push(second.id);
    expect(second.orderNumber).toBeGreaterThan(first.orderNumber);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe(OrderStatus.OPEN);
    expect(second.paymentStatus).toBe(PaymentStatus.UNPAID);

    const originalItems = await prisma.orderItem.findMany({ where: { orderId: first.id } });
    expect(originalItems[0]?.quantity).toBe(5);
    const originalStillVoided = await prisma.order.findUnique({ where: { id: first.id } });
    expect(originalStillVoided?.status).toBe(OrderStatus.CANCELLED);

    const afterReplacement = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(afterReplacement?.stockQuantity).toBe(startingStock - 2);
  });

  it("rejects waiter void after partial or full payment without changing stock", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const table = await prisma.serviceTable.findFirst({ where: { active: true } });
    const heineken = await prisma.product.findUnique({ where: { id: heinekenId } });
    if (!john || !table || !heineken) {
      throw new Error("Seed data is required for this test.");
    }

    const stockBefore = heineken.stockQuantity;
    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: heineken.id, quantity: 1 }],
      idempotencyKey: `test-void-paid-${Date.now()}`,
    });
    createdOrderIds.push(order.id);

    await prisma.order.update({
      where: { id: order.id },
      data: { paidAmount: 1000, paymentStatus: PaymentStatus.PARTIALLY_PAID },
    });
    const afterPartialSale = await prisma.product.findUnique({ where: { id: heineken.id } });
    const stockAfterSubmit = afterPartialSale?.stockQuantity ?? 0;

    await expect(
      cancelOrder({ orderId: order.id, userId: john.id, ownerWaiterId: john.id }),
    ).rejects.toThrow("A paid or partially paid order cannot be voided.");

    await prisma.order.update({
      where: { id: order.id },
      data: { paidAmount: order.total, paymentStatus: PaymentStatus.PAID },
    });
    await expect(
      cancelOrder({ orderId: order.id, userId: john.id, ownerWaiterId: john.id }),
    ).rejects.toThrow("A paid or partially paid order cannot be voided.");

    const stockAfter = await prisma.product.findUnique({ where: { id: heineken.id } });
    expect(stockAfter?.stockQuantity).toBe(stockAfterSubmit);
    expect(stockAfterSubmit).toBe(stockBefore - 1);
    const stillThere = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stillThere?.status).toBe(OrderStatus.OPEN);
  });
});
