import { loadEnvConfig } from "@next/env";
import { PaymentMethod } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { recordPaymentAction } from "@/actions/payments";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/services/orders";
import { cleanupInventoryArtifacts, createIsolatedPosProduct } from "@/services/__tests__/inventory-helpers";

loadEnvConfig(process.cwd());

const { testActor } = vi.hoisted(() => ({
  testActor: { id: "", name: "Test", role: "CASHIER" as Role },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: async (permission: Permission) => {
    if (!hasPermission(testActor.role, permission)) {
      throw new AppError("You are not allowed to do this.", "FORBIDDEN");
    }
    return testActor;
  },
}));

const createdOrderIds: string[] = [];
const createdTableIds: string[] = [];
let productId = "";
let categoryId = "";

beforeAll(async () => {
  const cashier = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
  if (!cashier) throw new Error("Seed data is required (Grace).");
  testActor.id = cashier.id;
  testActor.name = cashier.name;
  const isolated = await createIsolatedPosProduct({ sellingPrice: 3000, barQuantity: 20 });
  productId = isolated.product.id;
  categoryId = isolated.category.id;
});

afterAll(async () => {
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
    const numbers = orders.map((order) => String(order.orderNumber));
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: orderIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { reference: { in: numbers } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
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

describe("current cashier payment action contract", () => {
  it("records PaymentMethod.CASH only — no MOBILE_MONEY or CARD selector", async () => {
    const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
    if (!john) throw new Error("Seed data is required (John).");

    const table = await prisma.serviceTable.create({
      data: { name: `TEST-CASH-ONLY-${Date.now()}`, sortOrder: 9201 },
    });
    createdTableIds.push(table.id);
    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: `test-cash-only-order-${Date.now()}`,
    });
    createdOrderIds.push(order.id);

    const result = await recordPaymentAction({
      orderId: order.id,
      amount: 3000,
      idempotencyKey: `test-cash-only-pay-${Date.now()}`,
    });
    expect(result.ok).toBe(true);

    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.method).toBe(PaymentMethod.CASH);
    expect(payments[0]!.method).not.toBe(PaymentMethod.MOBILE_MONEY);
    expect(payments[0]!.method).not.toBe(PaymentMethod.CARD);
  });
});
