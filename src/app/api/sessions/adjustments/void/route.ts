import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { approveVoid, requireOperableSessionItem } from "@/lib/hospitality-service";
import { managerMaySelfApprove, verifyManagerApproval } from "@/lib/manager-approval";
import { pinSchema } from "@/lib/pin";
import { tillRoles } from "@/lib/roles";

const voidSchema = z.object({
  sessionItemId: z.string().cuid(),
  reason: z.string().min(3).max(500),
  managerUserId: z.string().cuid(),
  managerPin: pinSchema,
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = voidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid void request." }, { status: 400 });
  }

  try {
    await requireOperableSessionItem(parsed.data.sessionItemId, auth.user);
    const manager = await verifyManagerApproval({
      managerUserId: parsed.data.managerUserId,
      managerPin: parsed.data.managerPin,
      requesterId: auth.user.id,
      requesterRole: auth.user.role,
      allowSelfApproval: managerMaySelfApprove(auth.user.role),
      action: "VOID",
    });
    await approveVoid(parsed.data.sessionItemId, auth.user.id, manager.id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return hospitalityResponse(error, "Unable to process void.");
  }
}
