import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { allocateAcrossOrders, paymentStatusAfterAmount, validatePaymentAmount } from "@/lib/domain/payments";
import { AppError } from "@/lib/errors";
import { lockOrderForUpdate } from "@/lib/order-lock";
import { prisma } from "@/lib/prisma";
import { orderInclude } from "@/services/orders";

type Tx = Prisma.TransactionClient;

export type TablePaymentAllocation = {
  orderId: string;
  orderNumber: number;
  amount: number;
  paidAmount: number;
  remaining: number;
  paymentStatus: PaymentStatus;
};

export type TablePaymentResult = {
  amount: number;
  remaining: number;
  allocations: TablePaymentAllocation[];
};

function completeIfPaid(status: PaymentStatus, paidInFull: boolean) {
  return paidInFull || status === PaymentStatus.PAY_LATER
    ? { status: OrderStatus.COMPLETED, completedAt: new Date() }
    : {};
}

function isIdempotentReplay(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asAppError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Error) throw new AppError(error.message);
  throw error;
}

async function lockOrder(tx: Tx, orderId: string) {
  await lockOrderForUpdate(tx, orderId);
}

async function applyPaymentInTx(
  tx: Tx,
  input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
    cashierId: string;
    idempotencyKey: string;
  },
) {
  const existing = await tx.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { order: { include: orderInclude } },
  });
  if (existing) return existing.order;

  await lockOrder(tx, input.orderId);
  const order = await tx.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AppError("Order not found.");
  if (order.status === OrderStatus.CANCELLED) {
    throw new AppError("A cancelled order cannot be paid.");
  }

  let remainingAfter: number;
  try {
    ({ remainingAfter } = validatePaymentAmount(order.total, order.paidAmount, input.amount));
  } catch (error) {
    asAppError(error);
  }

  const nextPaid = order.paidAmount + input.amount;
  const nextStatus = paymentStatusAfterAmount(order.total, nextPaid);

  await tx.payment.create({
    data: {
      orderId: order.id,
      amount: input.amount,
      method: input.method,
      cashierId: input.cashierId,
      idempotencyKey: input.idempotencyKey,
    },
  });

  const updated = await tx.order.update({
    where: { id: order.id },
    data: {
      paidAmount: nextPaid,
      paymentStatus: nextStatus,
      ...completeIfPaid(nextStatus, remainingAfter === 0),
    },
    include: orderInclude,
  });

  await writeAudit({
    tx,
    userId: input.cashierId,
    action: "PAYMENT_RECORDED",
    entity: "Payment",
    entityId: order.id,
    before: { paidAmount: order.paidAmount, paymentStatus: order.paymentStatus },
    after: {
      amount: input.amount,
      method: input.method,
      paidAmount: nextPaid,
      paymentStatus: nextStatus,
      remaining: remainingAfter,
      orderNumber: order.orderNumber,
    },
  });

  return updated;
}

export async function recordPayment(input: {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  cashierId: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey.trim()) {
    throw new AppError("Missing payment key. Please try again.");
  }

  const replay = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { order: { include: orderInclude } },
  });
  if (replay) return replay.order;

  try {
    return await prisma.$transaction((tx) => applyPaymentInTx(tx, input));
  } catch (error) {
    if (isIdempotentReplay(error)) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { order: { include: orderInclude } },
      });
      if (existing) return existing.order;
    }
    throw error;
  }
}

function allocationFromOrder(
  order: { id: string; orderNumber: number; total: number; paidAmount: number; paymentStatus: PaymentStatus },
  amount: number,
): TablePaymentAllocation {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount,
    paidAmount: order.paidAmount,
    remaining: Math.max(0, order.total - order.paidAmount),
    paymentStatus: order.paymentStatus,
  };
}

async function tableRemaining(tx: Tx, tableId: string) {
  const open = await tx.order.findMany({
    where: {
      tableId,
      status: { not: OrderStatus.CANCELLED },
      paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
    },
  });
  return open.reduce((sum, order) => sum + Math.max(0, order.total - order.paidAmount), 0);
}

export async function recordTablePayment(input: {
  tableId: string;
  amount: number;
  method: PaymentMethod;
  cashierId: string;
  idempotencyKey: string;
}): Promise<TablePaymentResult> {
  if (!input.idempotencyKey.trim()) {
    throw new AppError("Missing payment key. Please try again.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const replayed = await tx.payment.findMany({
        where: { idempotencyKey: { startsWith: `${input.idempotencyKey}:` } },
        include: { order: true },
        orderBy: { idempotencyKey: "asc" },
      });
      if (replayed.length > 0) {
        return {
          amount: replayed.reduce((sum, payment) => sum + payment.amount, 0),
          remaining: await tableRemaining(tx, input.tableId),
          allocations: replayed.map((payment) => allocationFromOrder(payment.order, payment.amount)),
        };
      }

      const candidates = await tx.order.findMany({
        where: {
          tableId: input.tableId,
          status: { not: OrderStatus.CANCELLED },
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
        },
        select: { id: true },
        orderBy: { orderNumber: "asc" },
      });

      if (candidates.length === 0) {
        throw new AppError("There is nothing left to pay on this table.");
      }

      const ids = candidates.map((order) => order.id);
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;

      const orders = await tx.order.findMany({
        where: { id: { in: ids } },
        orderBy: { orderNumber: "asc" },
      });

      let plan: { orderId: string; amount: number }[];
      try {
        plan = allocateAcrossOrders(orders, input.amount);
      } catch (error) {
        asAppError(error);
      }

      const allocations: TablePaymentAllocation[] = [];
      for (const [index, allocation] of plan.entries()) {
        const updated = await applyPaymentInTx(tx, {
          orderId: allocation.orderId,
          amount: allocation.amount,
          method: input.method,
          cashierId: input.cashierId,
          idempotencyKey: `${input.idempotencyKey}:${index}`,
        });
        allocations.push(allocationFromOrder(updated, allocation.amount));
      }

      return {
        amount: input.amount,
        remaining: await tableRemaining(tx, input.tableId),
        allocations,
      };
    });
  } catch (error) {
    if (isIdempotentReplay(error)) {
      const replayed = await prisma.payment.findMany({
        where: { idempotencyKey: { startsWith: `${input.idempotencyKey}:` } },
        include: { order: true },
        orderBy: { idempotencyKey: "asc" },
      });
      if (replayed.length > 0) {
        const remaining = await prisma.order.findMany({
          where: {
            tableId: input.tableId,
            status: { not: OrderStatus.CANCELLED },
            paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
          },
        });
        return {
          amount: replayed.reduce((sum, payment) => sum + payment.amount, 0),
          remaining: remaining.reduce((sum, order) => sum + Math.max(0, order.total - order.paidAmount), 0),
          allocations: replayed.map((payment) => allocationFromOrder(payment.order, payment.amount)),
        };
      }
    }
    throw error;
  }
}

export async function markPayLater(input: {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  cashierId: string;
}) {
  const name = input.customerName.trim();
  if (name.length < 2) {
    throw new AppError("Customer name is required for pay later.");
  }

  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, input.orderId);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { credit: true },
    });
    if (!order) throw new AppError("Order not found.");
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError("A cancelled order cannot be marked pay later.");
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new AppError("This order is already paid.");
    }
    if (order.credit && !order.credit.settled) {
      throw new AppError("This order is already on pay later.");
    }

    const amountOwed = Math.max(0, order.total - order.paidAmount);
    if (amountOwed <= 0) {
      throw new AppError("There is no remaining balance.");
    }

    await tx.creditRecord.create({
      data: {
        orderId: order.id,
        customerName: name,
        customerPhone: input.customerPhone?.trim() || null,
        amountOwed,
        recordedById: input.cashierId,
      },
    });

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAY_LATER,
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: orderInclude,
    });

    await writeAudit({
      tx,
      userId: input.cashierId,
      action: "PAY_LATER_CREATED",
      entity: "CreditRecord",
      entityId: order.id,
      after: {
        customerName: name,
        customerPhone: input.customerPhone ?? null,
        amountOwed,
        orderNumber: order.orderNumber,
      },
    });

    return updated;
  });
}

export async function settleCredit(input: {
  creditId: string;
  method: PaymentMethod;
  cashierId: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey.trim()) {
    throw new AppError("Missing payment key. Please try again.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const credit = await tx.creditRecord.findUnique({
        where: { id: input.creditId },
        include: { order: true },
      });
      if (!credit) throw new AppError("Customer credit not found.");
      if (credit.settled) throw new AppError("This bill is already settled.");

      const updated = await applyPaymentInTx(tx, {
        orderId: credit.orderId,
        amount: credit.amountOwed,
        method: input.method,
        cashierId: input.cashierId,
        idempotencyKey: input.idempotencyKey,
      });

      await tx.creditRecord.update({
        where: { id: credit.id },
        data: {
          settled: true,
          settledById: input.cashierId,
          settledAt: new Date(),
        },
      });

      await writeAudit({
        tx,
        userId: input.cashierId,
        action: "PAY_LATER_SETTLED",
        entity: "CreditRecord",
        entityId: credit.id,
        after: {
          orderId: credit.orderId,
          amount: credit.amountOwed,
          method: input.method,
          customerName: credit.customerName,
        },
      });

      return updated;
    });
  } catch (error) {
    if (isIdempotentReplay(error)) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { order: { include: orderInclude } },
      });
      if (existing) return existing.order;
    }
    throw error;
  }
}

export async function listOutstanding() {
  return prisma.creditRecord.findMany({
    where: { settled: false },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      amountOwed: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          table: { select: { name: true } },
          waiter: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countOutstandingCredits() {
  return prisma.creditRecord.count({ where: { settled: false } });
}

export async function unsettledCreditTotal() {
  const result = await prisma.creditRecord.aggregate({
    where: { settled: false },
    _sum: { amountOwed: true },
  });
  return result._sum.amountOwed ?? 0;
}

/** Cash/payment activity by Payment.createdAt — not today’s sale-dated dashboard. */
export async function sumPaymentsReceived(from: Date, to: Date, method?: PaymentMethod) {
  const result = await prisma.payment.aggregate({
    where: {
      createdAt: { gte: from, lte: to },
      ...(method ? { method } : {}),
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function listPayments(from: Date, to: Date) {
  return prisma.payment.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      cashier: { select: { id: true, name: true } },
      order: {
        include: {
          waiter: { select: { id: true, name: true } },
          table: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listRecentPayments(take = 8, from?: Date, to?: Date) {
  return prisma.payment.findMany({
    take,
    where: from && to ? { createdAt: { gte: from, lte: to } } : undefined,
    include: {
      cashier: { select: { id: true, name: true } },
      order: {
        include: {
          waiter: { select: { id: true, name: true } },
          table: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
