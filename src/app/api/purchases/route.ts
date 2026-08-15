import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  supplierId: z.string().cuid().nullable(),
  referenceNumber: z.string().trim().min(2).max(80),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().positive().max(1_000_000),
    unitCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  })).min(1).max(100),
});

class PurchaseError extends Error {}

export async function POST(request: Request) {
  const auth = await requireApiUser(["OWNER", "ADMIN", "INVENTORY"]);
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the purchase details." }, { status: 400 });

  const combined = new Map<string, { quantity: number; unitCost: string }>();
  for (const item of parsed.data.items) {
    const existing = combined.get(item.productId);
    combined.set(item.productId, {
      quantity: (existing?.quantity ?? 0) + item.quantity,
      unitCost: item.unitCost,
    });
  }

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const productIds = [...combined.keys()];
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) throw new PurchaseError("One or more products were not found.");
      if (parsed.data.supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: parsed.data.supplierId, active: true } });
        if (!supplier) throw new PurchaseError("Supplier was not found.");
      }
      const productMap = new Map(products.map((product) => [product.id, product]));
      const lines = productIds.map((productId) => {
        const item = combined.get(productId)!;
        const unitCost = new Prisma.Decimal(item.unitCost);
        return { productId, quantity: item.quantity, unitCost, subtotal: unitCost.mul(item.quantity), product: productMap.get(productId)! };
      });
      const total = lines.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
      const created = await tx.purchase.create({
        data: {
          supplierId: parsed.data.supplierId,
          referenceNumber: parsed.data.referenceNumber,
          status: "RECEIVED",
          subtotal: total,
          total,
          receivedAt: new Date(),
          createdById: user.id,
          items: { create: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost, total: line.subtotal })) },
        },
      });
      for (const line of lines) {
        const updated = await tx.product.update({
          where: { id: line.productId },
          data: { stockQuantity: { increment: line.quantity }, costPrice: line.unitCost },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: line.productId,
            type: "PURCHASE",
            quantity: line.quantity,
            balanceAfter: updated.stockQuantity,
            referenceId: created.id,
            note: created.referenceNumber,
            performedById: user.id,
          },
        });
      }
      await tx.auditLog.create({
        data: { userId: user.id, action: "CREATE_PURCHASE", entity: "Purchase", entityId: created.id, details: { total: total.toFixed(2) } },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ id: purchase.id }, { status: 201 });
  } catch (error) {
    if (error instanceof PurchaseError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A purchase with this reference already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Purchase could not be received. Please try again." }, { status: 500 });
  }
}
