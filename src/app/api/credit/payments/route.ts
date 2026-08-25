import { PaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { recordCreditPayment } from "@/lib/hospitality-service";
import { IDEMPOTENCY_KEY_SCHEMA, scopedIdempotencyKey } from "@/lib/idempotency";
import { tillRoles } from "@/lib/roles";

const creditPaymentSchema = z.object({
  creditBillId: z.string().cuid(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_SCHEMA, "Invalid payment key."),
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = creditPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credit payment." }, { status: 400 });
  }

  try {
    const payment = await recordCreditPayment(parsed.data.creditBillId, auth.user.id, {
      amount: parsed.data.amount,
      method: parsed.data.method,
      idempotencyKey: scopedIdempotencyKey(auth.user.id, parsed.data.idempotencyKey),
    });
    return NextResponse.json({
      id: payment.id,
      amount: payment.amount,
      receivedById: payment.receivedById,
      creditBill: {
        id: payment.creditBill.id,
        status: payment.creditBill.status,
        balance: payment.creditBill.balance,
        total: payment.creditBill.total,
      },
    });
  } catch (error) {
    return hospitalityResponse(error, "Unable to record credit payment.");
  }
}
