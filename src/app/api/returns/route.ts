import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { canReturnQuantity } from "@/lib/reporting";
import { deductsPhysicalStock } from "@/lib/stock";

const schema = z.object({
  saleId: z.string().cuid(),
  reason: z.string().trim().min(3).max(300),
  items: z.array(z.object({ saleItemId: z.string().cuid(), quantity: z.number().int().positive() })).min(1),
});

class ReturnError extends Error {}

export async function POST(request: Request) {
  const auth = await requireApiUser(["OWNER", "ADMIN"]);
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the returned items." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: parsed.data.saleId, status: { in: ["COMPLETED", "PARTIALLY_RETURNED"] } },
        include: { items: { include: { product: true, productVariant: true } } },
      });
      if (!sale) throw new ReturnError("Completed sale not found.");
      const itemMap = new Map(sale.items.map((item) => [item.id, item]));
      const lines = parsed.data.items.map((input) => {
        const item = itemMap.get(input.saleItemId);
        if (!item || !canReturnQuantity(item.quantity, item.returnedQuantity, input.quantity)) {
          throw new ReturnError("Return quantity is more than originally sold.");
        }
        return { item, quantity: input.quantity, total: item.unitPrice.mul(input.quantity) };
      });
      const total = lines.reduce((sum, line) => sum.add(line.total), new Prisma.Decimal(0));
      const count = await tx.return.count();
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" }).replaceAll("-", "");
      const created = await tx.return.create({
        data: {
          returnNumber: `RET-${day}-${String(count + 1).padStart(5, "0")}`,
          saleId: sale.id,
          total,
          reason: parsed.data.reason,
          createdById: user.id,
          items: { create: lines.map((line) => ({ saleItemId: line.item.id, productId: line.item.productId, quantity: line.quantity, unitPrice: line.item.unitPrice, total: line.total })) },
        },
      });
      for (const line of lines) {
        await tx.saleItem.update({ where: { id: line.item.id }, data: { returnedQuantity: { increment: line.quantity } } });
        if (line.item.product.trackInventory && line.item.productVariant && deductsPhysicalStock(line.item.productVariant.unit)) {
          const product = await tx.product.update({ where: { id: line.item.productId }, data: { stockQuantity: { increment: line.quantity } } });
          await tx.inventoryMovement.create({
            data: { productId: product.id, type: "RETURN", quantity: line.quantity, balanceAfter: product.stockQuantity, referenceId: created.id, note: created.returnNumber, performedById: user.id },
          });
        }
      }
      const allReturned = sale.items.every((item) => {
        const added = lines.find((line) => line.item.id === item.id)?.quantity ?? 0;
        return item.returnedQuantity + added === item.quantity;
      });
      await tx.sale.update({ where: { id: sale.id }, data: { status: allReturned ? "RETURNED" : "PARTIALLY_RETURNED" } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorUsername: user.username,
          actorName: user.name ?? "",
          actorRole: user.role,
          action: "CREATE_RETURN",
          entity: "Return",
          entityId: created.id,
          details: { saleId: sale.id, total: total.toFixed(2) },
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ id: result.id, returnNumber: result.returnNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof ReturnError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to process the return. Please try again." }, { status: 500 });
  }
}
