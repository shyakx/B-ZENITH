import { MovementType, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { sumLineTotals } from "@/lib/domain/money";
import { CURRENT_TABLE_PAYMENT_STATUSES } from "@/lib/domain/payments";
import { nextStockAfterSale } from "@/lib/domain/stock";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { lockProductsForUpdate } from "@/lib/stock-lock";

const currentTableBillWhere: Prisma.OrderWhereInput = {
  status: { not: OrderStatus.CANCELLED },
  paymentStatus: { in: [...CURRENT_TABLE_PAYMENT_STATUSES] },
};

export const orderInclude = {
  waiter: { select: { id: true, name: true } },
  table: { select: { id: true, name: true } },
  items: { orderBy: { name: "asc" as const } },
  payments: {
    include: { cashier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  credit: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

type OrderItemInput = {
  productId: string;
  quantity: number;
};

export async function createOrder(input: {
  waiterId: string;
  tableId: string;
  items: OrderItemInput[];
  note?: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey.trim()) {
    throw new AppError("Missing order key. Please try again.");
  }
  if (input.items.length === 0) {
    throw new AppError("Add at least one product.");
  }

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: orderInclude,
  });
  if (existing) return existing;

  const table = await prisma.serviceTable.findUnique({ where: { id: input.tableId } });
  if (!table || !table.active) {
    throw new AppError("Choose a valid table.");
  }

  const uniqueIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: uniqueIds }, active: true },
  });
  if (products.length !== uniqueIds.length) {
    throw new AppError("One or more products are no longer available.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines = input.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new AppError("Product not found.");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError("Quantity must be a positive whole number.");
    }
    return {
      product,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      lineTotal: product.sellingPrice * item.quantity,
    };
  });

  const total = sumLineTotals(lines);

  try {
    return await prisma.$transaction(async (tx) => {
      const sequence = await tx.orderSequence.update({
        where: { id: 1 },
        data: { value: { increment: 1 } },
      });

      await lockProductsForUpdate(
        tx,
        lines.filter((line) => line.product.trackInventory).map((line) => line.product.id),
      );

      for (const line of lines) {
        if (!line.product.trackInventory) continue;
        const current = await tx.product.findUnique({ where: { id: line.product.id } });
        if (!current) throw new AppError("Product not found.");
        if (current.stockQuantity < line.quantity) {
          throw new AppError(
            `Not enough stock for ${current.name}. Available: ${current.stockQuantity}.`,
          );
        }
        const next = nextStockAfterSale(current.stockQuantity, line.quantity);
        await tx.product.update({
          where: { id: current.id },
          data: { stockQuantity: next },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: current.id,
            quantity: -line.quantity,
            type: MovementType.SALE,
            reason: "Order sale",
            userId: input.waiterId,
            reference: String(sequence.value),
          },
        });
      }

      const order = await tx.order.create({
        data: {
          orderNumber: sequence.value,
          idempotencyKey: input.idempotencyKey,
          waiterId: input.waiterId,
          tableId: input.tableId,
          status: OrderStatus.OPEN,
          paymentStatus: PaymentStatus.UNPAID,
          total,
          paidAmount: 0,
          note: input.note?.trim() || null,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              name: line.product.name,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: orderInclude,
      });

      await writeAudit({
        tx,
        userId: input.waiterId,
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: order.id,
        after: {
          orderNumber: order.orderNumber,
          table: table.name,
          total: order.total,
          items: lines.map((line) => ({
            name: line.product.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      });

      return order;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replayed = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: orderInclude,
      });
      if (replayed) return replayed;
    }
    throw error;
  }
}

export async function cancelOrder(input: {
  orderId: string;
  userId: string;
  ownerWaiterId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true, table: { select: { name: true } } },
    });
    if (!order) throw new AppError("Order not found.");
    if (input.ownerWaiterId && order.waiterId !== input.ownerWaiterId) {
      throw new AppError("You can only void your own orders.");
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError("This order is already cancelled.");
    }
    if (input.ownerWaiterId) {
      if (order.paidAmount > 0 || order.paymentStatus !== PaymentStatus.UNPAID) {
        throw new AppError("A paid or partially paid order cannot be voided.");
      }
    } else if (order.paidAmount > 0 || order.paymentStatus === PaymentStatus.PAID) {
      throw new AppError("A paid or partially paid order cannot be cancelled.");
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.trackInventory) continue;
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          quantity: item.quantity,
          type: MovementType.VOID_RESTORE,
          reason: "Cancelled order",
          userId: input.userId,
          reference: String(order.orderNumber),
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        completedAt: new Date(),
      },
      include: orderInclude,
    });

    await writeAudit({
      tx,
      userId: input.userId,
      action: "ORDER_CANCELLED",
      entity: "Order",
      entityId: order.id,
      before: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderNumber: order.orderNumber,
        table: order.table.name,
      },
      after: { status: updated.status, orderNumber: order.orderNumber, table: order.table.name },
    });

    return updated;
  });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
}

export async function getOrderByNumber(orderNumber: number) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });
}

export async function listOrders(filter: {
  waiterId?: string;
  tableId?: string;
  openOnly?: boolean;
  unpaidOnly?: boolean;
  from?: Date;
  to?: Date;
  take?: number;
}) {
  return prisma.order.findMany({
    where: {
      waiterId: filter.waiterId,
      tableId: filter.tableId,
      status: filter.openOnly ? OrderStatus.OPEN : undefined,
      paymentStatus: filter.unpaidOnly
        ? { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID, PaymentStatus.PAY_LATER] }
        : undefined,
      createdAt: {
        gte: filter.from,
        lte: filter.to,
      },
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 200,
  });
}

export async function getCurrentTableBill(tableId: string) {
  const table = await prisma.serviceTable.findUnique({
    where: { id: tableId },
    select: { id: true, name: true },
  });
  if (!table) return null;

  const orders = await prisma.order.findMany({
    where: { tableId, ...currentTableBillWhere },
    include: orderInclude,
    orderBy: { orderNumber: "asc" },
  });

  return { table, orders };
}

export async function listOpenOrdersByTable() {
  const orders = await prisma.order.findMany({
    where: currentTableBillWhere,
    include: orderInclude,
    orderBy: [{ table: { sortOrder: "asc" } }, { orderNumber: "asc" }],
  });

  const groups = new Map<string, { tableId: string; tableName: string; orders: OrderWithDetails[] }>();
  for (const order of orders) {
    const current = groups.get(order.tableId) ?? {
      tableId: order.tableId,
      tableName: order.table.name,
      orders: [],
    };
    current.orders.push(order);
    groups.set(order.tableId, current);
  }
  return [...groups.values()];
}
