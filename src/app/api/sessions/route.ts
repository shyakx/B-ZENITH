import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { openServiceSession } from "@/lib/hospitality-service";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ItemStatus, ServiceChannel, SessionStatus } from "@prisma/client";

const createSessionSchema = z.object({
  channel: z.nativeEnum(ServiceChannel),
  tableId: z.string().cuid().optional(),
  destinationLabel: z.string().trim().max(80).optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  deliveryAddress: z.string().trim().max(240).optional(),
});

function sessionPayload(session: {
  id: string;
  channel: ServiceChannel;
  status: SessionStatus;
  waiterId: string;
  waiter: { name: string | null };
  tableId: string | null;
  table: { id: string; name: string; status: string; sortOrder: number } | null;
  destinationLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  openedAt: Date;
  rounds: Array<{ items: Array<{ status: ItemStatus; unitPrice: { toNumber(): number } | number; qty: number }> }>;
}) {
  const items = session.rounds.flatMap((round) => round.items);
  const totalAmount = items
    .filter((item) => item.status === ItemStatus.ACTIVE)
    .reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  return {
    ...session,
    totalAmount,
    roundCount: session.rounds.length,
  };
}

export async function GET(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") as SessionStatus) || SessionStatus.ACTIVE;

  const sessions = await prisma.serviceSession.findMany({
    where: {
      status,
      ...(auth.user.role === "WAITER" ? { waiterId: auth.user.id } : {}),
    },
    include: {
      waiter: { select: { name: true } },
      table: true,
      rounds: { include: { items: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json(sessions.map(sessionPayload));
}

export async function POST(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const parsed = createSessionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session data." }, { status: 400 });
  }

  try {
    const session = await openServiceSession(auth.user.id, parsed.data);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return hospitalityResponse(error, "Unable to create session.");
  }
}
