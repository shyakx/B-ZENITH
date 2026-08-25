import { PaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { finalizeSettlement, requireOperableSession } from "@/lib/hospitality-service";
import { IDEMPOTENCY_KEY_SCHEMA, scopedIdempotencyKey } from "@/lib/idempotency";
import { managerMaySelfApprove, verifyManagerApproval } from "@/lib/manager-approval";
import { pinSchema } from "@/lib/pin";
import { tillRoles } from "@/lib/roles";

const settleSchema = z.object({
  sessionId: z.string().cuid(),
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_SCHEMA, "Invalid settlement key."),
  payments: z
    .array(
      z.object({
        method: z.nativeEnum(PaymentMethod),
        amount: z.number().positive(),
        cashReceived: z.number().positive().optional(),
      }),
    )
    .max(10),
  creditAmount: z.number().positive().optional(),
  chargeToRoom: z.boolean().optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  managerUserId: z.string().cuid().optional(),
  managerPin: pinSchema.optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = settleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settlement data." }, { status: 400 });
  }

  const creditAmount = parsed.data.creditAmount ?? 0;
  const chargeToRoom = Boolean(parsed.data.chargeToRoom);
  if (parsed.data.payments.length === 0 && creditAmount <= 0) {
    return NextResponse.json({ error: "Add a payment or convert the balance to credit." }, { status: 400 });
  }

  try {
    await requireOperableSession(parsed.data.sessionId, auth.user);
    let approvedById: string | undefined;
    if (creditAmount > 0 || chargeToRoom) {
      if (!parsed.data.managerUserId || !parsed.data.managerPin) {
        return NextResponse.json({ error: "Manager approval is required for credit." }, { status: 403 });
      }
      const manager = await verifyManagerApproval({
        managerUserId: parsed.data.managerUserId,
        managerPin: parsed.data.managerPin,
        requesterId: auth.user.id,
        requesterRole: auth.user.role,
        allowSelfApproval: managerMaySelfApprove(auth.user.role),
        action: chargeToRoom ? "CHARGE_TO_ROOM" : "CREDIT",
      });
      approvedById = manager.id;
    }

    const sale = await finalizeSettlement(parsed.data.sessionId, auth.user.id, {
      idempotencyKey: scopedIdempotencyKey(auth.user.id, parsed.data.idempotencyKey),
      payments: parsed.data.payments,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
      chargeToRoom,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      approvedById,
    });
    return NextResponse.json({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      amountPaid: sale.amountPaid,
      creditBill: sale.creditBill
        ? {
            id: sale.creditBill.id,
            status: sale.creditBill.status,
            total: sale.creditBill.total,
            balance: sale.creditBill.balance,
          }
        : null,
    });
  } catch (error) {
    return hospitalityResponse(error, "Unable to finalize settlement.");
  }
}
