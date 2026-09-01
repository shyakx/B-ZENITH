import { OrderStatus, PaymentStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const openPayment: PaymentStatus[] = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.PAY_LATER,
];

export async function salesSummary(from: Date, to: Date) {
  const orderWhere = {
    createdAt: { gte: from, lte: to },
    status: { not: OrderStatus.CANCELLED },
  } as const;

  const [
    orderTotals,
    paidOrderTotals,
    openOrderTotals,
    waiterGroups,
    paymentTotals,
    cashierGroups,
    productGroups,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { ...orderWhere, paymentStatus: PaymentStatus.PAID },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { ...orderWhere, paymentStatus: { in: openPayment } },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.order.groupBy({
      by: ["waiterId"],
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["cashierId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["name"],
      where: { order: orderWhere },
      _sum: { quantity: true, lineTotal: true },
    }),
  ]);

  const waiterIds = waiterGroups.map((group) => group.waiterId);
  const cashierIds = cashierGroups.map((group) => group.cashierId);
  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set([...waiterIds, ...cashierIds])] } },
    select: { id: true, name: true },
  });
  const names = new Map(people.map((person) => [person.id, person.name]));

  const waiters = waiterGroups
    .map((group) => ({
      name: names.get(group.waiterId) ?? "Unknown",
      orders: group._count._all,
      total: group._sum.total ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const cashiers = cashierGroups
    .map((group) => ({
      name: names.get(group.cashierId) ?? "Unknown",
      payments: group._count._all,
      total: group._sum.amount ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const products = productGroups
    .map((group) => ({
      name: group.name,
      quantity: group._sum.quantity ?? 0,
      total: group._sum.lineTotal ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    from,
    to,
    orderCount: orderTotals._count._all,
    orderTotal: orderTotals._sum.total ?? 0,
    paidSales: paidOrderTotals._sum.total ?? 0,
    collected: paymentTotals._sum.amount ?? 0,
    outstanding: Math.max(0, (openOrderTotals._sum.total ?? 0) - (openOrderTotals._sum.paidAmount ?? 0)),
    waiters,
    cashiers,
    products,
  };
}

export async function todaySummary() {
  return salesSummary(startOfDay(), endOfDay());
}
