import { ItemCondition } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { processReturn, requireOperableSessionItem } from "@/lib/hospitality-service";
import { managerMaySelfApprove, verifyManagerApproval } from "@/lib/manager-approval";
import { pinSchema } from "@/lib/pin";
import { tillRoles } from "@/lib/roles";

const returnSchema = z.object({
  sessionItemId: z.string().cuid(),
  quantity: z.number().int().positive(),
  reason: z.string().min(3).max(500),
  condition: z.nativeEnum(ItemCondition),
  managerUserId: z.string().cuid(),
  managerPin: pinSchema,
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = returnSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid return request." }, { status: 400 });
  }

  try {
    await requireOperableSessionItem(parsed.data.sessionItemId, auth.user);
    const manager = await verifyManagerApproval({
      managerUserId: parsed.data.managerUserId,
      managerPin: parsed.data.managerPin,
      requesterId: auth.user.id,
      requesterRole: auth.user.role,
      allowSelfApproval: managerMaySelfApprove(auth.user.role),
      action: "RETURN",
    });
    await processReturn(parsed.data.sessionItemId, auth.user.id, manager.id, {
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      condition: parsed.data.condition,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return hospitalityResponse(error, "Unable to process return.");
  }
}
