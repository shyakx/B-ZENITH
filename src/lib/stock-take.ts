import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocationByCode, LOCATION_CODES, setLocationQuantity, StockError } from "@/lib/location-stock";

export const STOCK_TAKE_ACTION = "STOCK_TAKE";

export class StockTakeError extends Error {}

export type StockTakeDetails = {
  productId: string;
  productName: string;
  previousQuantity: number;
  countedQuantity: number;
  adjustment: number;
  reason: string;
  locationCode?: string;
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
    locationCode: typeof value.locationCode === "string" ? value.locationCode : undefined,
    movementId: typeof value.movementId === "string" ? value.movementId : undefined,
  };
}

export async function applyStockTake(input: {
  userId: string;
  productId: string;
  countedQuantity: number;
  reason: string;
  confirmNegative: boolean;
  locationCode?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new StockTakeError("Product was not found.");
    if (!product.trackInventory) {
      throw new StockTakeError("Inventory tracking is disabled for this product.");
    }

    const location = await getLocationByCode(tx, input.locationCode || LOCATION_CODES.MAIN_STOCK);
    const current = await tx.productLocationStock.findUnique({
      where: { productId_locationId: { productId: product.id, locationId: location.id } },
    });
    const previousQuantity = current?.quantity ?? 0;
    const countedQuantity = input.countedQuantity;
    if (countedQuantity < 0) throw new StockTakeError("Physical count cannot be negative.");
    const adjustment = countedQuantity - previousQuantity;
    if (adjustment === 0) {
      throw new StockTakeError("Physical count matches system stock. No adjustment needed.");
    }
    if (adjustment < 0 && !input.confirmNegative) {
      throw new StockTakeError("Confirm this negative adjustment before applying it.");
    }

    try {
      await setLocationQuantity(tx, {
        productId: product.id,
        locationId: location.id,
        quantity: countedQuantity,
        type: "STOCK_TAKE",
        performedById: input.userId,
        reason: input.reason,
        note: `Stock take (${location.code}): ${input.reason}`,
      });
    } catch (error) {
      if (error instanceof StockError) throw new StockTakeError(error.message);
      throw error;
    }

    const movement = await tx.inventoryMovement.findFirst({
      where: { productId: product.id, type: "STOCK_TAKE", performedById: input.userId },
      orderBy: { createdAt: "desc" },
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
          locationCode: location.code,
          movementId: movement?.id,
        },
      },
    });

    return {
      productName: product.name,
      previousQuantity,
      countedQuantity,
      adjustment,
      locationCode: location.code,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
