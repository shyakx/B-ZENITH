/**
 * LEGACY counter checkout.
 * Hospitality POS uses /api/sessions/post (inventory) and /api/sessions/settle (finance).
 * Kept only for scripts/http-e2e.ts and scripts/business-scenario.ts.
 * Do not call this from /pos.
 */
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";
import {
  IDEMPOTENCY_KEY_SCHEMA,
  runIdempotentCreate,
  salePublicPayload,
  scopedIdempotencyKey,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { deductsPhysicalStock } from "@/lib/stock";
import { applyLocationDelta, sellingLocationId, StockError } from "@/lib/location-stock";
import { legacySaleAllowsNegativeStock } from "@/lib/inventory-auth";

const checkoutSchema = z.object({
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_SCHEMA, "Invalid checkout key."),
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
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "sessionId" in body) {
    return NextResponse.json({ error: "Hospitality checkout must use /api/sessions." }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the sale details and try again." }, { status: 400 });
  }

  const idempotencyKey = scopedIdempotencyKey(user.id, parsed.data.idempotencyKey);
  const combined = new Map<string, number>();
  for (const item of parsed.data.items) {
    combined.set(item.variantId, (combined.get(item.variantId) ?? 0) + item.quantity);
  }

  const findExisting = () =>
    prisma.sale.findUnique({
      where: { idempotencyKey },
      select: { id: true, receiptNumber: true, total: true },
    });

  try {
    const result = await runIdempotentCreate({
      findExisting,
      create: () =>
        prisma.$transaction(
          async (tx) => {
            const already = await tx.sale.findUnique({
              where: { idempotencyKey },
              select: { id: true, receiptNumber: true, total: true },
            });
            if (already) return already;

            const variants = await tx.productVariant.findMany({
              where: { id: { in: [...combined.keys()] }, active: true, product: { active: true } },
              include: { product: true },
            });
            if (variants.length !== combined.size) {
              throw new CheckoutError("Product is currently unavailable.");
            }

            const locationByVariant = new Map<string, string>();
            for (const variant of variants) {
              if (!variant.product.trackInventory || !deductsPhysicalStock(variant.unit)) continue;
              locationByVariant.set(variant.id, await sellingLocationId(tx, variant.product));
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
                idempotencyKey,
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
                payments: {
                  create: {
                    method: parsed.data.paymentMethod,
                    amount: total,
                    cashReceived: parsed.data.paymentMethod === "CASH" ? amountPaid : null,
                    change: parsed.data.paymentMethod === "CASH" ? amountPaid.sub(total) : null,
                    receivedById: user.id,
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
                    inventoryLocationId: locationByVariant.get(variant.id) ?? null,
                  })),
                },
              },
            });

            for (const { variant, quantity } of lineItems) {
              const locationId = locationByVariant.get(variant.id);
              if (!locationId) continue;
              try {
                await applyLocationDelta(tx, {
                  productId: variant.productId,
                  locationId,
                  delta: -quantity,
                  type: "SALE",
                  performedById: user.id,
                  referenceId: created.id,
                  note: created.receiptNumber,
                  allowNegative: legacySaleAllowsNegativeStock(),
                });
              } catch (error) {
                if (error instanceof StockError) throw new CheckoutError(error.message);
                throw error;
              }
            }

            await tx.auditLog.create({
              data: {
                userId: user.id,
                actorUsername: user.username,
                actorName: user.name ?? "",
                actorRole: user.role,
                action: "SALE_COMPLETED",
                entity: "Sale",
                entityId: created.id,
                details: { receiptNumber: created.receiptNumber, total: total.toFixed(2) },
              },
            });
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 },
        ),
    });

    return NextResponse.json(salePublicPayload(result.value), { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to complete sale. Please try again." }, { status: 500 });
  }
}
