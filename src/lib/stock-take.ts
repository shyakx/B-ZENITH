import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const STOCK_TAKE_ACTION = "STOCK_TAKE";

export class StockTakeError extends Error {}

export type StockTakeDetails = {
  productId: string;
  productName: string;
  previousQuantity: number;
  countedQuantity: number;
  adjustment: number;
  reason: string;
  movementId?: string;
};

export function parseStockTakeDetails(details: Prisma.JsonValue | null | undefined): StockTakeDetails | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = details as Record<string, unknown>;
  if (typeof value.productId !== "string") return null;
  if (typeof value.productName !== "string") return null;
  if (typeof value.previousQuantity !== "number") return null;
  if (typeof value.countedQuantity !== "number") return null;
  if (typeof value.adjustment !== "number") return null;
  if (typeof value.reason !== "string") return null;
  return {
    productId: value.productId,
    productName: value.productName,
    previousQuantity: value.previousQuantity,
    countedQuantity: value.countedQuantity,
    adjustment: value.adjustment,
    reason: value.reason,
    movementId: typeof value.movementId === "string" ? value.movementId : undefined,
  };
}

export async function applyStockTake(input: {
  userId: string;
  productId: string;
  countedQuantity: number;
  reason: string;
  confirmNegative: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new StockTakeError("Product was not found.");
    if (!product.trackInventory) {
      throw new StockTakeError("Inventory tracking is disabled for this product.");
    }

    const previousQuantity = product.stockQuantity;
    const countedQuantity = input.countedQuantity;
    if (countedQuantity < 0) throw new StockTakeError("Physical count cannot be negative.");

    const adjustment = countedQuantity - previousQuantity;
    if (adjustment === 0) {
      throw new StockTakeError("Physical count matches system stock. No adjustment needed.");
    }
    if (adjustment < 0 && !input.confirmNegative) {
      throw new StockTakeError("Confirm this negative adjustment before applying it.");
    }

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: countedQuantity },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "ADJUSTMENT",
        quantity: adjustment,
        balanceAfter: countedQuantity,
        note: `Stock take: ${input.reason}`,
        performedById: input.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: STOCK_TAKE_ACTION,
        entity: "Product",
        entityId: product.id,
        details: {
          productId: product.id,
          productName: product.name,
          previousQuantity,
          countedQuantity,
          adjustment,
          reason: input.reason,
          movementId: movement.id,
        },
      },
    });

    return {
      productName: product.name,
      previousQuantity,
      countedQuantity,
      adjustment,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
