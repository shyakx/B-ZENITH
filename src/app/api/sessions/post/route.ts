import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { postOrder, requireOperableSession } from "@/lib/hospitality-service";
import { IDEMPOTENCY_KEY_SCHEMA, scopedIdempotencyKey } from "@/lib/idempotency";
import { tillRoles } from "@/lib/roles";

const postOrderSchema = z.object({
  sessionId: z.string().cuid(),
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_SCHEMA, "Invalid checkout key."),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive().max(999),
    unitPrice: z.number().positive(),
  })).min(1).max(100),
});

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = postOrderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order data." }, { status: 400 });
  }

  try {
    await requireOperableSession(parsed.data.sessionId, auth.user);
    const round = await postOrder(
      parsed.data.sessionId,
      auth.user.id,
      parsed.data.items,
      scopedIdempotencyKey(auth.user.id, parsed.data.idempotencyKey),
    );
    return NextResponse.json(round, { status: 201 });
  } catch (error) {
    return hospitalityResponse(error, "Unable to post order.");
  }
}
