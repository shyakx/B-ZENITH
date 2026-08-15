import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { deductsPhysicalStock } from "@/lib/stock";

const checkoutSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().cuid(), quantity: z.number().int().positive().max(999) }))
    .min(1)
    .max(100),
  paymentMethod: z.enum(["CASH", "CARD", "MOBILE_MONEY"]),
  amountPaid: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  customerName: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});

class CheckoutError extends Error {}

function receiptNumber(sequence: number) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" }).replaceAll("-", "");
  return `BZ-${day}-${String(sequence).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["OWNER", "ADMIN", "WAITER"]);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the sale details and try again." }, { status: 400 });
  }

  const combined = new Map<string, number>();
  for (const item of parsed.data.items) {
    combined.set(item.variantId, (combined.get(item.variantId) ?? 0) + item.quantity);
  }

  try {
    const sale = await prisma.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: [...combined.keys()] }, active: true, product: { active: true } },
          include: { product: true },
        });
        if (variants.length !== combined.size) {
          throw new CheckoutError("Product is currently unavailable.");
        }

        const lineItems = variants.map((variant) => {
          const quantity = combined.get(variant.id)!;
          const lineSubtotal = variant.sellingPrice.mul(quantity);
          return { variant, quantity, lineSubtotal };
        });
        const subtotal = lineItems.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));
        const settings = await tx.businessSettings.upsert({
          where: { id: "default" },
          update: { receiptSequence: { increment: 1 } },
          create: { id: "default", receiptSequence: 1 },
        });
        const tax = settings.taxEnabled
          ? subtotal.mul(settings.taxRate).div(100).toDecimalPlaces(2)
          : new Prisma.Decimal(0);
        const total = subtotal.add(tax);
        const amountPaid =
          parsed.data.paymentMethod === "CASH" ? new Prisma.Decimal(parsed.data.amountPaid) : total;
        if (amountPaid.lessThan(total)) throw new CheckoutError("Cash received is less than the total.");

        const created = await tx.sale.create({
          data: {
            receiptNumber: receiptNumber(settings.receiptSequence),
            cashierId: user.id,
            customerName: parsed.data.customerName || null,
            subtotal,
            tax,
            discount: 0,
            total,
            amountPaid,
            change: amountPaid.sub(total),
            paymentMethod: parsed.data.paymentMethod,
            note: parsed.data.note || null,
            payment: {
              create: {
                method: parsed.data.paymentMethod,
                amount: total,
                cashReceived: parsed.data.paymentMethod === "CASH" ? amountPaid : null,
                change: parsed.data.paymentMethod === "CASH" ? amountPaid.sub(total) : null,
              },
            },
            items: {
              create: lineItems.map(({ variant, quantity, lineSubtotal }) => ({
                productId: variant.productId,
                productVariantId: variant.id,
                productName:
                  variant.name === "Portion" ? variant.product.name : `${variant.product.name} (${variant.name})`,
                productSku: variant.sku,
                variantName: variant.name,
                unitPrice: variant.sellingPrice,
                unitCost: variant.product.costPrice,
                quantity,
                lineSubtotal,
              })),
            },
          },
        });

        for (const { variant, quantity } of lineItems) {
          if (!variant.product.trackInventory || !deductsPhysicalStock(variant.unit)) continue;
          const result = await tx.product.updateMany({
            where: { id: variant.productId, active: true, stockQuantity: { gte: quantity } },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (result.count !== 1) throw new CheckoutError("Insufficient stock.");
          const updated = await tx.product.findUniqueOrThrow({
            where: { id: variant.productId },
            select: { stockQuantity: true },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: variant.productId,
              type: "SALE",
              quantity: -quantity,
              balanceAfter: updated.stockQuantity,
              referenceId: created.id,
              note: created.receiptNumber,
              performedById: user.id,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "SALE_COMPLETED",
            entity: "Sale",
            entityId: created.id,
            details: { receiptNumber: created.receiptNumber, total: total.toFixed(2) },
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 },
    );

    return NextResponse.json(
      {
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        total: sale.total.toFixed(2),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to complete sale. Please try again." }, { status: 500 });
  }
}
