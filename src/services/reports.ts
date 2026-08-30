import { OrderStatus, PaymentStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function salesSummary(from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { not: OrderStatus.CANCELLED },
    },
    include: {
      waiter: { select: { id: true, name: true } },
      items: true,
    },
  });

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { cashier: { select: { id: true, name: true } } },
  });

  const orderTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidSales = orders
    .filter((order) => order.paymentStatus === PaymentStatus.PAID)
    .reduce((sum, order) => sum + order.total, 0);
  const collected = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const openPayment: PaymentStatus[] = [
    PaymentStatus.UNPAID,
    PaymentStatus.PARTIALLY_PAID,
    PaymentStatus.PAY_LATER,
  ];
  const outstanding = orders
    .filter((order) => openPayment.includes(order.paymentStatus))
    .reduce((sum, order) => sum + Math.max(0, order.total - order.paidAmount), 0);

  const waiterMap = new Map<string, { name: string; orders: number; total: number }>();
  for (const order of orders) {
    const current = waiterMap.get(order.waiterId) ?? {
      name: order.waiter.name,
      orders: 0,
      total: 0,
    };
    current.orders += 1;
    current.total += order.total;
    waiterMap.set(order.waiterId, current);
  }

  const cashierMap = new Map<string, { name: string; payments: number; total: number }>();
  for (const payment of payments) {
    const current = cashierMap.get(payment.cashierId) ?? {
      name: payment.cashier.name,
      payments: 0,
      total: 0,
    };
    current.payments += 1;
    current.total += payment.amount;
    cashierMap.set(payment.cashierId, current);
  }

  const productMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = productMap.get(item.name) ?? { name: item.name, quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      productMap.set(item.name, current);
    }
  }

  return {
    from,
    to,
    orderCount: orders.length,
    orderTotal,
    paidSales,
    collected,
    outstanding,
    waiters: [...waiterMap.values()].sort((a, b) => b.total - a.total),
    cashiers: [...cashierMap.values()].sort((a, b) => b.total - a.total),
    products: [...productMap.values()].sort((a, b) => b.total - a.total),
  };
}

export async function todaySummary() {
  return salesSummary(startOfDay(), endOfDay());
}
