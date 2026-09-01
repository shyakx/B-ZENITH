import { loadEnvConfig } from "@next/env";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentTableBill, getOrderById, createOrder } from "@/services/orders";
import { recordPayment } from "@/services/payments";
import { cleanupInventoryArtifacts, createIsolatedPosProduct } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
const createdTableIds: string[] = [];
let productId = "";
let categoryId = "";

beforeAll(async () => {
  const isolated = await createIsolatedPosProduct({ sellingPrice: 2000, barQuantity: 30 });
  productId = isolated.product.id;
  categoryId = isolated.category.id;
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: createdOrderIds } },
      select: { id: true, orderNumber: true },
    });
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { reference: { in: numbers } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdOrderIds } } });
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

describe("current table bill against the database", () => {
  it("shows only unpaid/partial orders and still loads a paid order by id", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
    const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
    const table = await prisma.serviceTable.create({
      data: { name: `TEST-BILL-${Date.now()}`, sortOrder: 9000 },
    });
    createdTableIds.push(table.id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!john || !mary || !grace || !product) {
      throw new Error("Seed data is required (John, Mary, Grace).");
    }

    const stamp = Date.now();
    const paid = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `test-bill-paid-${stamp}`,
    });
    createdOrderIds.push(paid.id);
    await recordPayment({
      orderId: paid.id,
      amount: paid.total,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-bill-pay-${stamp}`,
    });

    const unpaid = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 2 }],
      idempotencyKey: `test-bill-unpaid-${stamp}`,
    });
    const partial = await createOrder({
      waiterId: mary.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 3 }],
      idempotencyKey: `test-bill-partial-${stamp}`,
    });
    createdOrderIds.push(unpaid.id, partial.id);
    await recordPayment({
      orderId: partial.id,
      amount: 2000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `test-bill-partial-pay-${stamp}`,
    });

    const current = await getCurrentTableBill(table.id);
    expect(current?.table.id).toBe(table.id);
    expect(current?.orders.map((order) => order.id).sort()).toEqual([unpaid.id, partial.id].sort());
    expect(current?.orders.map((order) => order.waiter.name).sort()).toEqual(["John", "Mary"]);
    expect(current?.orders.some((order) => order.id === paid.id)).toBe(false);

    const cancelled = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `test-bill-cancel-${stamp}`,
    });
    createdOrderIds.push(cancelled.id);
    await prisma.order.update({
      where: { id: cancelled.id },
      data: { status: OrderStatus.CANCELLED },
    });

    const afterCancel = await getCurrentTableBill(table.id);
    expect(afterCancel?.orders.map((order) => order.id)).not.toContain(cancelled.id);

    const historical = await getOrderById(paid.id);
    expect(historical?.id).toBe(paid.id);
    expect(historical?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(historical?.paidAmount).toBe(paid.total);
  });
});
