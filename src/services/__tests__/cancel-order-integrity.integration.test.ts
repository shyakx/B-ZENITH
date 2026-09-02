import { loadEnvConfig } from "@next/env";
import { BusinessArea, MovementType, OrderStatus, PaymentMethod, PaymentStatus, ProductType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOrder, createOrder } from "@/services/orders";
import { markPayLater, recordPayment } from "@/services/payments";
import { cleanupInventoryArtifacts, createIsolatedPosProduct, stockAt } from "./inventory-helpers";

loadEnvConfig(process.cwd());

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdTableIds: string[] = [];

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
    await prisma.inventoryMovement.deleteMany({
      where: {
        OR: [{ reference: { in: numbers } }, { orderId: { in: createdOrderIds } }],
      },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (createdProductIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({ where: { productId: { in: createdProductIds } } });
    await cleanupInventoryArtifacts(createdProductIds);
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
  if (createdTableIds.length > 0) {
    await prisma.serviceTable.deleteMany({ where: { id: { in: createdTableIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
  await prisma.$disconnect();
});

async function staff() {
  const john = await prisma.user.findFirst({ where: { name: "John", role: "WAITER" } });
  const mary = await prisma.user.findFirst({ where: { name: "Mary", role: "WAITER" } });
  const grace = await prisma.user.findFirst({ where: { name: "Grace", role: "CASHIER" } });
  if (!john || !mary || !grace) {
    throw new Error("Seed data is required (John, Mary, Grace).");
  }
  return { john, mary, grace };
}

async function isolatedTable() {
  const table = await prisma.serviceTable.create({
    data: {
      name: `CX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      active: true,
      sortOrder: 9300,
    },
  });
  createdTableIds.push(table.id);
  return table;
}

async function trackedProduct(barQuantity: number, sellingPrice = 20000) {
  const isolated = await createIsolatedPosProduct({ sellingPrice, barQuantity });
  createdProductIds.push(isolated.product.id);
  createdCategoryIds.push(isolated.category.id);
  return isolated.product;
}

async function untrackedProduct(sellingPrice: number) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await prisma.category.create({
    data: { name: `Untracked ${stamp}`, area: BusinessArea.KITCHEN },
  });
  createdCategoryIds.push(category.id);
  const product = await prisma.product.create({
    data: {
      name: `Plate ${stamp}`,
      categoryId: category.id,
      sellingPrice,
      trackInventory: false,
      productType: ProductType.MENU_ITEM,
      sellOnPos: true,
      active: true,
    },
  });
  createdProductIds.push(product.id);
  return product;
}

async function voidRestores(orderId: string) {
  return prisma.inventoryMovement.findMany({
    where: { orderId, type: MovementType.VOID_RESTORE },
  });
}

async function sales(orderId: string) {
  return prisma.inventoryMovement.findMany({
    where: { orderId, type: MovementType.SALE },
  });
}

describe("cancelOrder integrity against the database", () => {
  it("cancels an unpaid 20,000 order, restores tracked stock once, and writes one VOID_RESTORE", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(1, 20000);
    const before = await stockAt(product.id, "BAR");

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-basic-${product.id}`,
    });
    createdOrderIds.push(order.id);
    expect(order.total).toBe(20000);
    expect(await stockAt(product.id, "BAR")).toBe(before - 1);

    const cancelled = await cancelOrder({ orderId: order.id, userId: grace.id });
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(cancelled.paidAmount).toBe(0);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await stockAt(product.id, "BAR")).toBe(before);

    const restores = await voidRestores(order.id);
    expect(restores).toHaveLength(1);
    expect(restores[0]?.quantity).toBe(1);
    const saleMoves = await sales(order.id);
    expect(saleMoves).toHaveLength(1);
    expect(saleMoves[0]!.quantity + restores[0]!.quantity).toBe(0);
  });

  it("does not restore stock again when the same order is cancelled twice", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(2, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-twice-${product.id}`,
    });
    createdOrderIds.push(order.id);

    await cancelOrder({ orderId: order.id, userId: grace.id });
    await expect(cancelOrder({ orderId: order.id, userId: grace.id })).rejects.toThrow(
      "This order is already cancelled.",
    );

    expect(await stockAt(product.id, "BAR")).toBe(2);
    expect(await voidRestores(order.id)).toHaveLength(1);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe(OrderStatus.CANCELLED);
    expect(row?.paidAmount).toBe(0);
  });

  it("rejects cancellation of a fully paid order without restoring stock", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(3, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-paid-${product.id}`,
    });
    createdOrderIds.push(order.id);

    await recordPayment({
      orderId: order.id,
      amount: 20000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `cx-paid-pay-${product.id}`,
    });

    await expect(cancelOrder({ orderId: order.id, userId: grace.id })).rejects.toThrow(
      "A paid or partially paid order cannot be cancelled.",
    );

    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).not.toBe(OrderStatus.CANCELLED);
    expect(row?.paidAmount).toBe(20000);
    expect(await stockAt(product.id, "BAR")).toBe(2);
    expect(await voidRestores(order.id)).toHaveLength(0);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("rejects cancellation after a 5,000 partial on a 20,000 bill", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(4, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-partial-${product.id}`,
    });
    createdOrderIds.push(order.id);

    await recordPayment({
      orderId: order.id,
      amount: 5000,
      method: PaymentMethod.CASH,
      cashierId: grace.id,
      idempotencyKey: `cx-partial-pay-${product.id}`,
    });

    await expect(cancelOrder({ orderId: order.id, userId: grace.id })).rejects.toThrow(
      "A paid or partially paid order cannot be cancelled.",
    );

    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe(OrderStatus.OPEN);
    expect(row?.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(row?.paidAmount).toBe(5000);
    expect(await stockAt(product.id, "BAR")).toBe(3);
    expect(await voidRestores(order.id)).toHaveLength(0);
  });

  it("rejects PAY_LATER cancellation, keeps the CreditRecord, and does not restore stock", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(5, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-later-${product.id}`,
    });
    createdOrderIds.push(order.id);

    await markPayLater({
      orderId: order.id,
      customerName: "Jean Credit",
      cashierId: grace.id,
    });

    await expect(cancelOrder({ orderId: order.id, userId: grace.id })).rejects.toThrow(
      "Customer credit must be resolved before the order can be cancelled.",
    );

    const row = await prisma.order.findUnique({
      where: { id: order.id },
      include: { credit: true, payments: true },
    });
    expect(row?.status).toBe(OrderStatus.COMPLETED);
    expect(row?.paymentStatus).toBe(PaymentStatus.PAY_LATER);
    expect(row?.paidAmount).toBe(0);
    expect(row?.credit?.settled).toBe(false);
    expect(row?.credit?.amountOwed).toBe(20000);
    expect(row?.credit?.customerName).toBe("Jean Credit");
    expect(row?.payments).toHaveLength(0);
    expect(await stockAt(product.id, "BAR")).toBe(4);
    expect(await voidRestores(order.id)).toHaveLength(0);
  });

  it("lets only one of two concurrent cancellations restore stock", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(1, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-race-cancel-${product.id}`,
    });
    createdOrderIds.push(order.id);

    const results = await Promise.allSettled([
      cancelOrder({ orderId: order.id, userId: grace.id }),
      cancelOrder({ orderId: order.id, userId: john.id, ownerWaiterId: john.id }),
    ]);

    const ok = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(String((failed[0] as PromiseRejectedResult).reason)).toMatch(/already cancelled/);

    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe(OrderStatus.CANCELLED);
    expect(row?.paidAmount).toBe(0);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await stockAt(product.id, "BAR")).toBe(1);
    expect(await voidRestores(order.id)).toHaveLength(1);
  });

  it("serializes concurrent cancel vs payment so a paid order is never CANCELLED", async () => {
    const { john, grace } = await staff();
    let sawPaymentWin = false;
    let sawCancelWin = false;

    for (let round = 0; round < 8; round += 1) {
      const table = await isolatedTable();
      const product = await trackedProduct(1, 20000);
      const order = await createOrder({
        waiterId: john.id,
        tableId: table.id,
        items: [{ productId: product.id, quantity: 1 }],
        idempotencyKey: `cx-vs-pay-${product.id}-${round}`,
      });
      createdOrderIds.push(order.id);

      const results = await Promise.allSettled([
        cancelOrder({ orderId: order.id, userId: grace.id }),
        recordPayment({
          orderId: order.id,
          amount: 20000,
          method: PaymentMethod.CASH,
          cashierId: grace.id,
          idempotencyKey: `cx-vs-pay-key-${product.id}-${round}`,
        }),
      ]);

      const row = await prisma.order.findUnique({
        where: { id: order.id },
        include: { payments: true },
      });
      const restores = await voidRestores(order.id);
      const paid = (row?.paidAmount ?? 0) > 0 || row!.payments.length > 0;
      const cancelled = row?.status === OrderStatus.CANCELLED;

      expect(paid && cancelled).toBe(false);
      if (cancelled) {
        expect(paid).toBe(false);
        expect(row?.payments).toHaveLength(0);
        expect(restores).toHaveLength(1);
        expect(await stockAt(product.id, "BAR")).toBe(1);
        sawCancelWin = true;
      } else {
        expect(paid).toBe(true);
        expect(row?.paidAmount).toBe(20000);
        expect(row?.payments).toHaveLength(1);
        expect(restores).toHaveLength(0);
        expect(await stockAt(product.id, "BAR")).toBe(0);
        sawPaymentWin = true;
      }

      const rejected = results.filter((result) => result.status === "rejected");
      expect(rejected).toHaveLength(1);
    }

    expect(sawPaymentWin || sawCancelWin).toBe(true);
  });

  it("rejects payment on an already-cancelled order and keeps a second cancel from restoring stock", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(2, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-already-${product.id}`,
    });
    createdOrderIds.push(order.id);
    await cancelOrder({ orderId: order.id, userId: grace.id });

    await expect(
      recordPayment({
        orderId: order.id,
        amount: 20000,
        method: PaymentMethod.CASH,
        cashierId: grace.id,
        idempotencyKey: `cx-already-pay-${product.id}`,
      }),
    ).rejects.toThrow("A cancelled order cannot be paid.");

    await expect(cancelOrder({ orderId: order.id, userId: grace.id })).rejects.toThrow(
      "This order is already cancelled.",
    );

    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await voidRestores(order.id)).toHaveLength(1);
    expect(await stockAt(product.id, "BAR")).toBe(2);
  });

  it("restores only tracked lines and keeps cancellation atomic with an untracked item", async () => {
    const { john, grace } = await staff();
    const table = await isolatedTable();
    const bottled = await trackedProduct(6, 15000);
    const plate = await untrackedProduct(5000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [
        { productId: bottled.id, quantity: 1 },
        { productId: plate.id, quantity: 1 },
      ],
      idempotencyKey: `cx-mix-${bottled.id}`,
    });
    createdOrderIds.push(order.id);
    expect(order.total).toBe(20000);

    await cancelOrder({ orderId: order.id, userId: grace.id });

    expect(await stockAt(bottled.id, "BAR")).toBe(6);
    expect(await voidRestores(order.id)).toHaveLength(1);
    expect(
      await prisma.inventoryMovement.count({ where: { orderId: order.id, productId: plate.id } }),
    ).toBe(0);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe(OrderStatus.CANCELLED);
    expect(row?.total).toBe(20000);
  });

  it("still blocks a waiter from voiding another waiter's unpaid order", async () => {
    const { john, mary } = await staff();
    const table = await isolatedTable();
    const product = await trackedProduct(3, 20000);

    const order = await createOrder({
      waiterId: john.id,
      tableId: table.id,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `cx-auth-${product.id}`,
    });
    createdOrderIds.push(order.id);

    await expect(
      cancelOrder({ orderId: order.id, userId: mary.id, ownerWaiterId: mary.id }),
    ).rejects.toThrow("You can only void your own orders.");

    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe(OrderStatus.OPEN);
    expect(await voidRestores(order.id)).toHaveLength(0);
    expect(await stockAt(product.id, "BAR")).toBe(2);
  });
});
