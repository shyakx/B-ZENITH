"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { catalogRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { applyStockTake } from "@/lib/stock-take";

export async function adjustInventory(formData: FormData) {
  const user = await requireUser(catalogRoles);
  const input = z.object({
    productId: z.string().cuid(),
    quantity: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
    note: z.string().trim().min(3).max(300),
  }).parse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });
    const balanceAfter = product.stockQuantity + input.quantity;
    if (balanceAfter < 0) throw new Error("Adjustment would make stock negative.");
    await tx.product.update({ where: { id: product.id }, data: { stockQuantity: balanceAfter } });
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "ADJUSTMENT",
        quantity: input.quantity,
        balanceAfter,
        note: input.note,
        performedById: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        actorUsername: user.username,
        actorName: user.name ?? "",
        actorRole: user.role,
        action: "INVENTORY_ADJUSTMENT",
        entity: "InventoryMovement",
        entityId: movement.id,
        details: { productId: product.id, quantity: input.quantity, balanceAfter },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function recordStockTake(formData: FormData) {
  const user = await requireUser(catalogRoles);
  const input = z.object({
    productId: z.string().cuid(),
    countedQuantity: z.coerce.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(3).max(300),
    confirmNegative: z.coerce.boolean().optional().default(false),
  }).parse({
    productId: formData.get("productId"),
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
  });

  revalidatePath("/inventory");
  revalidatePath("/reports");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}
