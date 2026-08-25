import type { AdjustmentType, CreditStatus, PaymentMethod, ServiceChannel } from "@prisma/client";

export function aggregatePaymentRecords(
  payments: Array<{ method: PaymentMethod | string; amount: number }>,
) {
  const totals = new Map<string, { count: number; amount: number }>();
  for (const payment of payments) {
    const row = totals.get(payment.method) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount = Math.round((row.amount + payment.amount + Number.EPSILON) * 100) / 100;
    totals.set(payment.method, row);
  }
  return totals;
}

export function aggregatePostedBy(
  rounds: Array<{ postedById: string; postedByName: string; itemCount: number }>,
) {
  const totals = new Map<string, { name: string; rounds: number; items: number }>();
  for (const round of rounds) {
    const row = totals.get(round.postedById) ?? { name: round.postedByName, rounds: 0, items: 0 };
    row.rounds += 1;
    row.items += round.itemCount;
    totals.set(round.postedById, row);
  }
  return totals;
}

export function aggregateAdjustments(rows: Array<{ type: AdjustmentType | string; quantity: number }>) {
  const totals = new Map<string, { count: number; quantity: number }>();
  for (const row of rows) {
    const current = totals.get(row.type) ?? { count: 0, quantity: 0 };
    current.count += 1;
    current.quantity += row.quantity;
    totals.set(row.type, current);
  }
  return totals;
}

export function aggregateCreditBills(
  bills: Array<{ status: CreditStatus | string; total: number; balance: number }>,
) {
  const totals = new Map<string, { count: number; total: number; balance: number }>();
  for (const bill of bills) {
    const row = totals.get(bill.status) ?? { count: 0, total: 0, balance: 0 };
    row.count += 1;
    row.total += bill.total;
    row.balance += bill.balance;
    totals.set(bill.status, row);
  }
  return totals;
}

export function aggregateChannelSales(
  sales: Array<{ channel: ServiceChannel | string | null; total: number }>,
) {
  const totals = new Map<string, { count: number; total: number }>();
  for (const sale of sales) {
    const channel = sale.channel ?? "LEGACY";
    const row = totals.get(channel) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += sale.total;
    totals.set(channel, row);
  }
  return totals;
}

export function aggregateStaffCounts(rows: Array<{ staffId: string; name: string }>) {
  const totals = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const current = totals.get(row.staffId) ?? { name: row.name, count: 0 };
    current.count += 1;
    totals.set(row.staffId, current);
  }
  return totals;
}

function money(value: { toNumber(): number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}

/** Read-only hospitality reporting slice. Must never write inventory. */
export async function loadHospitalityReport(start: Date, end: Date) {
  const { prisma } = await import("@/lib/prisma");
  const range = { gte: start, lt: end };
  const [
    payments,
    sales,
    rounds,
    adjustments,
    bills,
    fulfillmentHistory,
    openHistory,
    locationStock,
    productStock,
    movementGroups,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: range },
      select: { method: true, amount: true },
    }),
    prisma.sale.findMany({
      where: { status: { not: "VOIDED" }, createdAt: range },
      select: {
        total: true,
        cashierId: true,
        cashier: { select: { name: true } },
        session: { select: { channel: true } },
      },
    }),
    prisma.orderRound.findMany({
      where: { timestamp: range },
      select: {
        postedById: true,
        postedBy: { select: { name: true } },
        items: { select: { qty: true, unitPrice: true, status: true } },
      },
    }),
    prisma.orderAdjustment.findMany({
      where: { createdAt: range },
      select: {
        type: true,
        quantity: true,
        requestedById: true,
        requestedBy: { select: { name: true } },
        approvedById: true,
        approvedBy: { select: { name: true } },
      },
    }),
    prisma.creditBill.findMany({
      where: { createdAt: range },
      select: { status: true, total: true, balance: true },
    }),
    prisma.sessionItemFulfillmentHistory.findMany({
      where: { timestamp: range },
      select: { staffId: true, staff: { select: { name: true } } },
    }),
    prisma.sessionStaffHistory.findMany({
      where: { timestamp: range, action: "OPENED" },
      select: { staffId: true, staff: { select: { name: true } } },
    }),
    prisma.productLocationStock.aggregate({ _sum: { quantity: true } }),
    prisma.product.aggregate({ _sum: { stockQuantity: true } }),
    prisma.inventoryMovement.groupBy({
      by: ["type"],
      where: { createdAt: range },
      _sum: { quantity: true },
      _count: true,
    }),
  ]);

  const operationalTotal = rounds.reduce((sum, round) => {
    return (
      sum +
      round.items
        .filter((item) => item.status === "ACTIVE")
        .reduce((line, item) => line + money(item.unitPrice) * item.qty, 0)
    );
  }, 0);

  return {
    paymentTotals: aggregatePaymentRecords(payments.map((row) => ({ method: row.method, amount: money(row.amount) }))),
    financialTotal: sales.reduce((sum, sale) => sum + money(sale.total), 0),
    operationalTotal,
    channelTotals: aggregateChannelSales(
      sales.map((sale) => ({ channel: sale.session?.channel ?? null, total: money(sale.total) })),
    ),
    postedBy: aggregatePostedBy(
      rounds.map((round) => ({
        postedById: round.postedById,
        postedByName: round.postedBy.name,
        itemCount: round.items.reduce((sum, item) => sum + item.qty, 0),
      })),
    ),
    settlementStaff: aggregateStaffCounts(sales.map((sale) => ({ staffId: sale.cashierId, name: sale.cashier.name }))),
    sessionOpeners: aggregateStaffCounts(openHistory.map((row) => ({ staffId: row.staffId, name: row.staff.name }))),
    fulfillmentStaff: aggregateStaffCounts(
      fulfillmentHistory.map((row) => ({ staffId: row.staffId, name: row.staff.name })),
    ),
    adjustmentRequesters: aggregateStaffCounts(
      adjustments.map((row) => ({ staffId: row.requestedById, name: row.requestedBy.name })),
    ),
    adjustmentApprovers: aggregateStaffCounts(
      adjustments
        .filter((row) => row.approvedById && row.approvedBy)
        .map((row) => ({ staffId: row.approvedById!, name: row.approvedBy!.name })),
    ),
    adjustments: aggregateAdjustments(adjustments),
    credit: aggregateCreditBills(
      bills.map((bill) => ({ status: bill.status, total: money(bill.total), balance: money(bill.balance) })),
    ),
    inventory: {
      locationStockSum: locationStock._sum.quantity ?? 0,
      productStockSum: productStock._sum.stockQuantity ?? 0,
      movements: movementGroups.map((row) => ({
        type: row.type,
        count: row._count,
        quantity: row._sum.quantity ?? 0,
      })),
    },
  };
}
