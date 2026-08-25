import { ItemCondition } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { processExchange, requireOperableSessionItem } from "@/lib/hospitality-service";
import { managerMaySelfApprove, verifyManagerApproval } from "@/lib/manager-approval";
import { pinSchema } from "@/lib/pin";
import { tillRoles } from "@/lib/roles";

const exchangeSchema = z.object({
  originalItemId: z.string().cuid(),
  replacement: z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  }),
  reason: z.string().min(3).max(500),
  condition: z.nativeEnum(ItemCondition).default(ItemCondition.RESELLABLE),
  managerUserId: z.string().cuid(),
  managerPin: pinSchema,
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = exchangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid exchange request." }, { status: 400 });
  }

  try {
    await requireOperableSessionItem(parsed.data.originalItemId, auth.user);
    const manager = await verifyManagerApproval({
      managerUserId: parsed.data.managerUserId,
      managerPin: parsed.data.managerPin,
      requesterId: auth.user.id,
      requesterRole: auth.user.role,
      allowSelfApproval: managerMaySelfApprove(auth.user.role),
      action: "EXCHANGE",
    });
    await processExchange(
      parsed.data.originalItemId,
      auth.user.id,
      manager.id,
      parsed.data.replacement,
      parsed.data.reason,
      parsed.data.condition,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return hospitalityResponse(error, "Unable to process exchange.");
  }
}
