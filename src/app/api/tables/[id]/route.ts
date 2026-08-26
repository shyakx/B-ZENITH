import { NextResponse } from "next/server";
import { Prisma, SessionStatus } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireApiUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  canDeactivateTable,
  canManageTables,
  tableAdminRoles,
  tableNameTaken,
  updateTableWriteData,
} from "@/lib/table-admin";

const updateSchema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(tableAdminRoles);
  if (!auth.ok) return auth.response;
  if (!canManageTables(auth.user.role)) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table data." }, { status: 400 });
  }

  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          sessions: { where: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } } },
        },
      },
    },
  });
  if (!table) return NextResponse.json({ error: "Table not found." }, { status: 404 });

  if (parsed.data.active === false) {
    const allowed = canDeactivateTable({
      status: table.status,
      openSessionCount: table._count.sessions,
    });
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 409 });
  }

  if (parsed.data.name !== undefined) {
    const others = await prisma.table.findMany({
      where: { id: { not: id } },
      select: { name: true },
    });
    if (tableNameTaken(parsed.data.name, others.map((row) => row.name))) {
      return NextResponse.json({ error: "A table with that name already exists." }, { status: 409 });
    }
  }

  const write = updateTableWriteData(parsed.data);
  if (!write.ok) return NextResponse.json({ error: write.error }, { status: 400 });

  try {
    const updated = await prisma.table.update({
      where: { id },
      data: write.data,
    });
    await writeAudit(auth.user, {
      action: "UPDATE_TABLE",
      entity: "Table",
      entityId: updated.id,
      details: { name: updated.name, active: updated.active },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A table with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update table." }, { status: 500 });
  }
}
