import { MovementType, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { sumLineTotals } from "@/lib/domain/money";
import { CURRENT_TABLE_PAYMENT_STATUSES } from "@/lib/domain/payments";
import { nextStockAfterIncrease, nextStockAfterSale, saleStockMessage } from "@/lib/domain/stock";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { lockProductStocksForUpdate } from "@/lib/stock-lock";
import {
  applyStockChange,
  ensureTrackedProductStocks,
  rethrowDomain,
} from "@/services/stock";

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

export const orderListInclude = {
  waiter: { select: { id: true, name: true } },
  table: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

export const orderWaiterListInclude = {
  waiter: { select: { id: true, name: true } },
  table: { select: { id: true, name: true } },
  items: { select: { id: true, productId: true, name: true, quantity: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type OrderListItem = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;
export type OrderWaiterListItem = Prisma.OrderGetPayload<{ include: typeof orderWaiterListInclude }>;

const orderListFilter = (filter: {
  waiterId?: string;
  tableId?: string;
  openOnly?: boolean;
  unpaidOnly?: boolean;
  from?: Date;
  to?: Date;
}): Prisma.OrderWhereInput => ({
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
});

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
    where: { id: { in: uniqueIds }, active: true, sellOnPos: true },
    include: { defaultStockLocation: true },
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

      const tracked = lines.filter((line) => line.product.trackInventory);
      for (const line of tracked) {
        if (!line.product.sellOnPos) {
          throw new AppError(`${line.product.name} cannot be sold on POS.`);
        }
        const location = line.product.defaultStockLocation;
        if (!location || !location.active) {
          throw new AppError(`${line.product.name} has no operational stock location.`);
        }
        if (location.code === LOCATION_CODES.MAIN || location.kind !== "OPERATIONAL") {
          throw new AppError("POS cannot take stock from Main Stock.");
        }
        await ensureTrackedProductStocks(tx, line.product.id);
      }

      await lockProductStocksForUpdate(
        tx,
        tracked.map((line) => ({
          productId: line.product.id,
          locationId: line.product.defaultStockLocation!.id,
        })),
      );

      const running = new Map<string, number>();
      for (const line of tracked) {
        const location = line.product.defaultStockLocation!;
        const key = `${line.product.id}:${location.id}`;
        if (!running.has(key)) {
          const stock = await tx.productStock.findUnique({
            where: {
              productId_locationId: { productId: line.product.id, locationId: location.id },
            },
          });
          running.set(key, stock?.quantity ?? 0);
        }
        const available = running.get(key) ?? 0;
        if (available < line.quantity) {
          throw new AppError(saleStockMessage(line.product.name, location.name, available));
        }
        try {
          running.set(key, nextStockAfterSale(available, line.quantity));
        } catch {
          throw new AppError(saleStockMessage(line.product.name, location.name, available));
        }
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
              stockLocationId: line.product.trackInventory
                ? line.product.defaultStockLocation?.id ?? null
                : null,
            })),
          },
        },
        include: orderInclude,
      });

      for (const item of order.items) {
        const product = productMap.get(item.productId);
        if (!product?.trackInventory) continue;
        const location = product.defaultStockLocation!;
        const stock = await tx.productStock.findUnique({
          where: { productId_locationId: { productId: product.id, locationId: location.id } },
        });
        const available = stock?.quantity ?? 0;
        if (available < item.quantity) {
          throw new AppError(saleStockMessage(product.name, location.name, available));
        }
        let next: number;
        try {
          next = nextStockAfterSale(available, item.quantity);
        } catch {
          throw new AppError(saleStockMessage(product.name, location.name, available));
        }
        await applyStockChange(tx, {
          productId: product.id,
          locationId: location.id,
          next,
          delta: -item.quantity,
          type: MovementType.SALE,
          userId: input.waiterId,
          reason: "Order sale",
          reference: String(sequence.value),
          orderId: order.id,
          orderItemId: item.id,
        });
      }

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
      include: {
        items: true,
        table: { select: { name: true } },
      },
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

    const restore: { itemId: string; productId: string; locationId: string; quantity: number }[] = [];
    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { defaultStockLocation: true },
      });
      if (!product || !product.trackInventory) continue;
      const locationId = item.stockLocationId ?? product.defaultStockLocationId;
      const location = locationId
        ? await tx.stockLocation.findUnique({ where: { id: locationId } })
        : null;
      if (!location || !location.active || location.code === LOCATION_CODES.MAIN || location.kind !== "OPERATIONAL") {
        throw new AppError(`Cannot restore ${product.name} to an operational location.`);
      }
      await ensureTrackedProductStocks(tx, product.id);
      restore.push({
        itemId: item.id,
        productId: product.id,
        locationId: location.id,
        quantity: item.quantity,
      });
    }

    await lockProductStocksForUpdate(
      tx,
      restore.map((row) => ({ productId: row.productId, locationId: row.locationId })),
    );

    for (const row of restore) {
      const stock = await tx.productStock.findUnique({
        where: { productId_locationId: { productId: row.productId, locationId: row.locationId } },
      });
      if (!stock) throw new AppError("Stock record not found.");
      let next: number;
      try {
        next = nextStockAfterIncrease(stock.quantity, row.quantity);
      } catch (error) {
        rethrowDomain(error);
      }
      await applyStockChange(tx, {
        productId: row.productId,
        locationId: row.locationId,
        next,
        delta: row.quantity,
        type: MovementType.VOID_RESTORE,
        userId: input.userId,
        reason: "Cancelled order",
        reference: String(order.orderNumber),
        orderId: order.id,
        orderItemId: row.itemId,
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

type OrderListFilter = {
  waiterId?: string;
  tableId?: string;
  openOnly?: boolean;
  unpaidOnly?: boolean;
  from?: Date;
  to?: Date;
  take?: number;
};

export async function listOrders(filter: OrderListFilter & { withItems: true }): Promise<OrderWaiterListItem[]>;
export async function listOrders(filter: OrderListFilter & { withItems?: false }): Promise<OrderListItem[]>;
export async function listOrders(filter: OrderListFilter & { withItems?: boolean }) {
  const where = orderListFilter(filter);
  const take = filter.take ?? 200;
  if (filter.withItems) {
    return prisma.order.findMany({
      where,
      include: orderWaiterListInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  }
  return prisma.order.findMany({
    where,
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function todayLiveOrderTotals(from: Date, to: Date) {
  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: from, lte: to },
    status: { not: OrderStatus.CANCELLED },
  };
  const [ordersToday, sales] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
  ]);
  return { ordersToday, salesToday: sales._sum.total ?? 0 };
}

export async function payableOutstandingBalance() {
  const orders = await prisma.order.findMany({
    where: currentTableBillWhere,
    select: { total: true, paidAmount: true },
  });
  return orders.reduce((sum, order) => sum + Math.max(0, order.total - order.paidAmount), 0);
}

export async function countOpenBillsByStatus() {
  const groups = await prisma.order.groupBy({
    by: ["paymentStatus"],
    where: currentTableBillWhere,
    _count: { _all: true },
  });
  const counts = Object.fromEntries(groups.map((group) => [group.paymentStatus, group._count._all]));
  return {
    unpaidBills: counts[PaymentStatus.UNPAID] ?? 0,
    partialBills: counts[PaymentStatus.PARTIALLY_PAID] ?? 0,
  };
}

export async function waiterTodaySnapshot(waiterId: string, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { waiterId, createdAt: { gte: from, lte: to } },
    select: {
      tableId: true,
      table: { select: { name: true } },
      items: { select: { quantity: true } },
    },
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
    include: orderListInclude,
    orderBy: [{ table: { sortOrder: "asc" } }, { orderNumber: "asc" }],
  });

  const groups = new Map<string, { tableId: string; tableName: string; orders: OrderListItem[] }>();
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
