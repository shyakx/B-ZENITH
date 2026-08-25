import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { hospitalityResponse } from "@/lib/hospitality-http";
import { requireOperableSession } from "@/lib/hospitality-service";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const auth = await requireApiUser(tillRoles);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    try {
      await requireOperableSession(id, auth.user);
    } catch (error) {
      return hospitalityResponse(error, "Unable to load session.");
    }

    const session = await prisma.serviceSession.findUnique({
      where: { id },
      include: {
        waiter: { select: { name: true } },
        table: true,
        rounds: {
          orderBy: { timestamp: "desc" },
          include: {
            postedBy: { select: { name: true } },
            items: {
              include: {
                product: { select: { name: true } },
                productVariant: { select: { name: true } },
                fulfillmentHistory: {
                    include: { staff: { select: { name: true } } },
                    orderBy: { timestamp: 'desc' }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
          },
        },
        staffHistory: {
          include: { staff: { select: { name: true } } },
          orderBy: { timestamp: "desc" },
        },
        adjustments: {
            include: {
                requestedBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        }
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Calculate total amount from active items
    const allItems = session.rounds.flatMap(r => r.items);
    const totalAmount = allItems
        .filter(i => i.status === 'ACTIVE')
        .reduce((sum, i) => sum + (Number(i.unitPrice) * i.qty), 0);

    return NextResponse.json({
        ...session,
        totalAmount,
        roundCount: session.rounds.length
    });
}
