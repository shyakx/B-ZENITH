"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function adjustInventory(formData: FormData) {
  const user = await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
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
