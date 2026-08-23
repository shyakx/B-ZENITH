"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/authorization";
import { canDeleteTransactions } from "@/lib/business-day";
import { kigaliDateString } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { applyLocationDelta, getLocationByCode, LOCATION_CODES, restoreLocationId, saleVoidClaimed, StockError } from "@/lib/location-stock";
import { deductsPhysicalStock } from "@/lib/stock";

export async function voidSale(saleId: string) {
  const user = await requireUser(["ADMIN"]);
  if (!canDeleteTransactions(user.role)) return { error: "Only an admin can delete transactions." };

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: { include: { product: true, productVariant: true } } },
  });
  if (!sale) return { error: "Sale not found." };
  if (sale.status === "VOIDED") return { error: "This sale is already deleted." };
  if (sale.status !== "COMPLETED" || sale.items.some((item) => item.returnedQuantity > 0)) {
    return { error: "Returned sales cannot be deleted. Use a return instead." };
  }

  const businessDay = kigaliDateString(sale.createdAt);
  const closed = await prisma.businessDayClose.findUnique({ where: { businessDay } });
  if (closed) {
    return { error: "This day’s sales are archived. Open them from Closed days instead of deleting." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.sale.updateMany({
          where: { id: sale.id, status: "COMPLETED" },
          data: { status: "VOIDED" },
        });
        if (!saleVoidClaimed(claimed.count)) {
          throw new StockError("This sale was already changed and cannot be voided.");
        }
        const main = await getLocationByCode(tx, LOCATION_CODES.MAIN_STOCK);
        for (const item of sale.items) {
          const unit = item.productVariant?.unit ?? item.product.unit;
          if (!item.product.trackInventory || !deductsPhysicalStock(unit)) continue;
          await applyLocationDelta(tx, {
            productId: item.productId,
            locationId: restoreLocationId(item.inventoryLocationId, main.id),
            delta: item.quantity,
            type: "ADJUSTMENT",
            performedById: user.id,
            referenceId: sale.id,
            note: "Voided sale",
          });
        }
        await writeAudit(
          user,
          {
            action: "VOID_SALE",
            entity: "Sale",
            entityId: sale.id,
            details: { receiptNumber: sale.receiptNumber },
          },
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function deleteBilliardDaySale(id: string) {
  const user = await requireUser(["ADMIN"]);
  const row = await prisma.billiardDaySale.findUnique({ where: { id } });
  if (!row) return { error: "Billiard total not found." };
  const closed = await prisma.businessDayClose.findUnique({ where: { businessDay: row.businessDay } });
  if (closed) return { error: "That business day is already closed." };
  await prisma.billiardDaySale.delete({ where: { id } });
  await writeAudit(user, {
    action: "DELETE_BILLIARD_DAY_SALE",
    entity: "BilliardDaySale",
    entityId: id,
    details: { businessDay: row.businessDay },
  });
  revalidatePath("/sales");
  revalidatePath("/billiard");
  revalidatePath("/dashboard");
}
