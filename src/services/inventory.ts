import { MovementType } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import {
  nextStockAfterAdjustment,
  nextStockAfterCount,
  nextStockAfterIncrease,
  nextStockAfterWaste,
} from "@/lib/domain/stock";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { lockProductForUpdate } from "@/lib/stock-lock";

async function requireTrackedProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("Product not found.");
  if (!product.trackInventory) {
    throw new AppError("This product does not track inventory.");
  }
  return product;
}

export async function receivePurchase(input: {
  productId: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
  userId: string;
}) {
  await requireTrackedProduct(input.productId);

  return prisma.$transaction(async (tx) => {
    await lockProductForUpdate(tx, input.productId);
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.trackInventory) {
      throw new AppError("This product does not track inventory.");
    }
    const next = nextStockAfterIncrease(product.stockQuantity, input.quantity);

    const purchase = await tx.purchase.create({
      data: {
        productId: product.id,
        quantity: input.quantity,
        unitCost: input.unitCost,
        notes: input.notes?.trim() || null,
        userId: input.userId,
      },
    });
    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: next, costPrice: input.unitCost ?? product.costPrice },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        quantity: input.quantity,
        type: MovementType.PURCHASE,
        reason: input.notes?.trim() || "Purchase received",
        userId: input.userId,
        reference: purchase.id,
      },
    });
    await writeAudit({
      tx,
      userId: input.userId,
      action: "STOCK_RECEIVED",
      entity: "Purchase",
      entityId: purchase.id,
      before: { stockQuantity: product.stockQuantity },
      after: { quantity: input.quantity, stockQuantity: next, unitCost: input.unitCost ?? null },
    });
    return purchase;
  });
}

export async function recordWaste(input: {
  productId: string;
  quantity: number;
  reason: string;
  userId: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 2) throw new AppError("Give a short reason for waste.");
  await requireTrackedProduct(input.productId);

  return prisma.$transaction(async (tx) => {
    await lockProductForUpdate(tx, input.productId);
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.trackInventory) {
      throw new AppError("This product does not track inventory.");
    }
    const next = nextStockAfterWaste(product.stockQuantity, input.quantity);

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: next },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        quantity: -input.quantity,
        type: MovementType.WASTE,
        reason,
        userId: input.userId,
      },
    });
    await writeAudit({
      tx,
      userId: input.userId,
      action: "STOCK_WASTE",
      entity: "InventoryMovement",
      entityId: movement.id,
      before: { stockQuantity: product.stockQuantity },
      after: { quantity: input.quantity, reason, stockQuantity: next },
    });
    return movement;
  });
}

export async function adjustStock(input: {
  productId: string;
  delta: number;
  reason: string;
  userId: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 2) throw new AppError("Give a short reason for the adjustment.");
  await requireTrackedProduct(input.productId);

  return prisma.$transaction(async (tx) => {
    await lockProductForUpdate(tx, input.productId);
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.trackInventory) {
      throw new AppError("This product does not track inventory.");
    }
    const next = nextStockAfterAdjustment(product.stockQuantity, input.delta);

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: next },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        quantity: input.delta,
        type: MovementType.ADJUSTMENT,
        reason,
        userId: input.userId,
      },
    });
    await writeAudit({
      tx,
      userId: input.userId,
      action: "STOCK_ADJUSTED",
      entity: "InventoryMovement",
      entityId: movement.id,
      before: { stockQuantity: product.stockQuantity },
      after: { delta: input.delta, reason, stockQuantity: next },
    });
    return movement;
  });
}

export async function countStock(input: {
  productId: string;
  counted: number;
  userId: string;
}) {
  await requireTrackedProduct(input.productId);

  return prisma.$transaction(async (tx) => {
    await lockProductForUpdate(tx, input.productId);
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.trackInventory) {
      throw new AppError("This product does not track inventory.");
    }
    const { next } = nextStockAfterCount(input.counted);
    const delta = next - product.stockQuantity;

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: next },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        quantity: delta,
        type: MovementType.COUNT,
        reason: "Stock count",
        userId: input.userId,
      },
    });
    await writeAudit({
      tx,
      userId: input.userId,
      action: "STOCK_COUNTED",
      entity: "InventoryMovement",
      entityId: movement.id,
      before: { stockQuantity: product.stockQuantity },
      after: { counted: next, delta },
    });
    return movement;
  });
}

export async function listStock(lowOnly = false) {
  return prisma.product.findMany({
    where: {
      trackInventory: true,
      active: true,
      ...(lowOnly ? { stockQuantity: { lte: 5 } } : {}),
    },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export async function listMovements(take = 150) {
  return prisma.inventoryMovement.findMany({
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listPurchases(take = 100) {
  return prisma.purchase.findMany({
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}
