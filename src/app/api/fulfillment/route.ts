import { FulfillmentStatus, ItemStatus, SessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { updateFulfillment } from "@/lib/hospitality-service";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const locationCode = new URL(request.url).searchParams.get("location");
  if (!locationCode) {
    return NextResponse.json({ error: "Location is required." }, { status: 400 });
  }

  const items = await prisma.sessionItem.findMany({
    where: {
      status: ItemStatus.ACTIVE,
      fulfillmentStatus: {
        in: [FulfillmentStatus.POSTED, FulfillmentStatus.PREPARING, FulfillmentStatus.READY],
      },
      inventoryLocation: { code: locationCode },
      round: { session: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } } },
    },
    include: {
      product: { select: { name: true } },
      productVariant: { select: { name: true } },
      fulfillmentStaff: { select: { name: true } },
      round: {
        include: {
          postedBy: { select: { name: true } },
          session: {
            include: {
              table: { select: { name: true } },
              waiter: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      qty: item.qty,
      productName: item.product.name,
      variantName: item.productVariant?.name ?? null,
      fulfillmentStatus: item.fulfillmentStatus,
      postedAt: item.createdAt.toISOString(),
      tableName: item.round.session.table?.name ?? null,
      channel: item.round.session.channel,
      destination: item.round.session.destinationLabel,
      postedByName: item.round.postedBy.name,
      currentWaiterName: item.round.session.waiter.name ?? "Staff",
      fulfillmentStaffName: item.fulfillmentStaff?.name ?? null,
      elapsedMinutes: Math.floor((now.getTime() - item.createdAt.getTime()) / 60000),
    })),
  );
}

const patchSchema = z.object({
  itemId: z.string().cuid(),
  status: z.nativeEnum(FulfillmentStatus),
});

export async function PATCH(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Item ID and status are required." }, { status: 400 });
  }

  try {
    await updateFulfillment(parsed.data.itemId, auth.user.id, parsed.data.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return hospitalityResponse(error, "Unable to update fulfillment.");
  }
}
