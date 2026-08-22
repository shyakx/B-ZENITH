import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { catalogRoles } from "@/lib/roles";
import { applyStockTake, StockTakeError } from "@/lib/stock-take";

const schema = z.object({
  productId: z.string().cuid(),
  countedQuantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(300),
  confirmNegative: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const auth = await requireApiUser(catalogRoles);
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the stock-take details." }, { status: 400 });
  }

  try {
    const result = await applyStockTake({
      userId: auth.user.id,
      productId: parsed.data.productId,
      countedQuantity: parsed.data.countedQuantity,
      reason: parsed.data.reason,
      confirmNegative: parsed.data.confirmNegative,
    });
    revalidatePath("/inventory");
    revalidatePath("/reports");
    revalidatePath("/pos");
    revalidatePath("/dashboard");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StockTakeError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Stock take could not be recorded. Please try again." }, { status: 500 });
  }
}
