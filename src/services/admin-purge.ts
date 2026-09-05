import { OrderStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { nextStockAfterIncrease } from "@/lib/domain/stock";
import { AppError } from "@/lib/errors";
import { lockProductStocksForUpdate } from "@/lib/stock-lock";
import { prisma } from "@/lib/prisma";
import { ensureTrackedProductStocks, rethrowDomain, syncCompatibilityStock } from "@/services/stock";

const CONFIRM_WORD = "DELETE";

export function requirePurgeConfirm(confirm: string) {
  if (confirm.trim().toUpperCase() !== CONFIRM_WORD) {
    throw new AppError(`Type ${CONFIRM_WORD} to confirm.`);
  }
}

export async function listSalesForDay(from: Date, to: Date) {
  return prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      waiter: { select: { name: true } },
      table: { select: { name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countMaisonRecords() {
  return prisma.maisonRecord.count();
}

async function restoreTrackedStock(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    status: OrderStatus;
    items: { id: string; productId: string; quantity: number; stockLocationId: string | null }[];
  },
) {
  if (order.status === OrderStatus.CANCELLED) return;

  const restore: { productId: string; locationId: string; quantity: number }[] = [];
  for (const item of order.items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      include: { defaultStockLocation: true },
    });
    if (!product?.trackInventory) continue;
    const locationId = item.stockLocationId ?? product.defaultStockLocationId;
    const location = locationId ? await tx.stockLocation.findUnique({ where: { id: locationId } }) : null;
    if (!location || !location.active || location.code === LOCATION_CODES.MAIN || location.kind !== "OPERATIONAL") {
      throw new AppError(`Cannot restore ${product.name} to an operational location.`);
    }
    await ensureTrackedProductStocks(tx, product.id);
    restore.push({ productId: product.id, locationId: location.id, quantity: item.quantity });
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
    await tx.productStock.update({
      where: { productId_locationId: { productId: row.productId, locationId: row.locationId } },
      data: { quantity: next },
    });
    await syncCompatibilityStock(tx, row.productId);
  }
}

async function purgeOneOrder(orderId: string) {
  await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payments: { select: { id: true } }, credit: { select: { id: true } } },
      });
      if (!order) return;

      await restoreTrackedStock(tx, order);

      const paymentIds = order.payments.map((row) => row.id);
      const creditIds = order.credit ? [order.credit.id] : [];

      await tx.inventoryMovement.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.creditRecord.deleteMany({ where: { orderId } });
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { entity: "Order", entityId: orderId },
            ...(paymentIds.length ? [{ entity: "Payment", entityId: { in: paymentIds } }] : []),
            ...(creditIds.length ? [{ entity: "CreditRecord", entityId: { in: creditIds } }] : []),
          ],
        },
      });
      await tx.order.delete({ where: { id: orderId } });
    },
    { timeout: 20000 },
  );
}

export async function purgeOrders(orderIds: string[], actorId: string) {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (unique.length === 0) throw new AppError("Select at least one order.");

  for (const id of unique) {
    await purgeOneOrder(id);
  }

  await writeAudit({
    userId: actorId,
    action: "SALES_PURGED",
    entity: "Order",
    entityId: unique[0],
    after: { count: unique.length, orderIds: unique },
  });

  return { count: unique.length };
}

export async function purgeMaisonRecords(actorId: string) {
  const records = await prisma.maisonRecord.findMany({ select: { id: true } });
  const ids = records.map((row) => row.id);
  if (ids.length === 0) return { count: 0 };

  await prisma.$transaction(async (tx) => {
    const payments = await tx.maisonPayment.findMany({
      where: { maisonRecordId: { in: ids } },
      select: { id: true },
    });
    await tx.maisonPayment.deleteMany({ where: { maisonRecordId: { in: ids } } });
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { entity: "MaisonRecord", entityId: { in: ids } },
          ...(payments.length
            ? [{ entity: "MaisonPayment", entityId: { in: payments.map((row) => row.id) } }]
            : []),
        ],
      },
    });
    await tx.maisonRecord.deleteMany({ where: { id: { in: ids } } });
  });

  await writeAudit({
    userId: actorId,
    action: "MAISON_PURGED",
    entity: "MaisonRecord",
    entityId: ids[0],
    after: { count: ids.length },
  });

  return { count: ids.length };
}
