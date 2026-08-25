"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { stockMutateRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { applyStockTake } from "@/lib/stock-take";
import {
  applyLocationDelta,
  getLocationByCode,
  LOCATION_CODES,
  recordStockTransfer,
  StockError,
} from "@/lib/location-stock";

export async function adjustInventory(formData: FormData) {
  const user = await requireUser(stockMutateRoles);
  const input = z.object({
    productId: z.string().cuid(),
    locationCode: z.enum([LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN]),
    quantity: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
    note: z.string().trim().min(3).max(300),
  }).parse({
    productId: formData.get("productId"),
    locationCode: formData.get("locationCode") || LOCATION_CODES.MAIN_STOCK,
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });

  await prisma.$transaction(async (tx) => {
    const location = await getLocationByCode(tx, input.locationCode);
    try {
      await applyLocationDelta(tx, {
        productId: input.productId,
        locationId: location.id,
        delta: input.quantity,
        type: "ADJUSTMENT",
        performedById: user.id,
        note: `${location.code}: ${input.note}`,
      });
    } catch (error) {
      if (error instanceof StockError) throw error;
      throw error;
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        actorUsername: user.username,
        actorName: user.name ?? "",
        actorRole: user.role,
        action: "INVENTORY_ADJUSTMENT",
        entity: "Product",
        entityId: input.productId,
        details: { productId: input.productId, quantity: input.quantity, locationCode: input.locationCode },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function recordStockTake(formData: FormData) {
  const user = await requireUser(stockMutateRoles);
  const input = z.object({
    productId: z.string().cuid(),
    locationCode: z.enum([LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN]),
    countedQuantity: z.coerce.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(3).max(300),
    confirmNegative: z.coerce.boolean().optional().default(false),
  }).parse({
    productId: formData.get("productId"),
    locationCode: formData.get("locationCode") || LOCATION_CODES.MAIN_STOCK,
    countedQuantity: formData.get("countedQuantity"),
    reason: formData.get("reason"),
    confirmNegative: formData.get("confirmNegative") === "on" || formData.get("confirmNegative") === "true",
  });

  await applyStockTake({
    userId: user.id,
    productId: input.productId,
    countedQuantity: input.countedQuantity,
    reason: input.reason,
    confirmNegative: input.confirmNegative,
    locationCode: input.locationCode,
  });

  revalidatePath("/inventory");
  revalidatePath("/reports");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function transferStock(formData: FormData) {
  const user = await requireUser(stockMutateRoles);
  const toCode = String(formData.get("toCode") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map((value) => Number(value));
  const lines = productIds
    .map((productId, index) => ({ productId, quantity: quantities[index] }))
    .filter((line) => line.productId && line.quantity);

  try {
    await prisma.$transaction(
      async (tx) =>
        recordStockTransfer(tx, {
          fromCode: LOCATION_CODES.MAIN_STOCK,
          toCode,
          lines,
          recordedById: user.id,
          note,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  revalidatePath("/inventory/operations");
  return { ok: true as const };
}

export async function recordWaste(formData: FormData) {
  const user = await requireUser(stockMutateRoles);
  const input = z.object({
    productId: z.string().cuid(),
    locationCode: z.enum([LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN]),
    quantity: z.coerce.number().int().positive().max(1_000_000),
    reason: z.enum(["BREAKAGE", "SPOILAGE", "EXPIRED", "DAMAGED", "INTERNAL_USE", "OTHER"]),
    note: z.string().trim().max(300).optional().default(""),
  }).parse({
    productId: formData.get("productId"),
    locationCode: formData.get("locationCode"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    note: formData.get("note") || "",
  });

  await prisma.$transaction(async (tx) => {
    const location = await getLocationByCode(tx, input.locationCode);
    const current = await tx.productLocationStock.findUnique({
      where: { productId_locationId: { productId: input.productId, locationId: location.id } },
    });
    const onHand = current?.quantity ?? 0;
    if (onHand < input.quantity) {
      throw new StockError("Waste cannot take stock below zero.");
    }
    await applyLocationDelta(tx, {
      productId: input.productId,
      locationId: location.id,
      delta: -input.quantity,
      type: "WASTE",
      performedById: user.id,
      reason: input.reason,
      note: input.note || undefined,
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        actorUsername: user.username,
        actorName: user.name ?? "",
        actorRole: user.role,
        action: "INVENTORY_WASTE",
        entity: "Product",
        entityId: input.productId,
        details: {
          productId: input.productId,
          quantity: input.quantity,
          locationCode: input.locationCode,
          reason: input.reason,
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath("/inventory");
  revalidatePath("/inventory/operations");
  revalidatePath("/pos");
  revalidatePath("/reports");
}
