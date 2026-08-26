import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireApiUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { tillRoles } from "@/lib/roles";
import {
  canManageTables,
  createTableWriteData,
  tableAdminRoles,
  tableNameTaken,
} from "@/lib/table-admin";

const createSchema = z.object({
  name: z.string(),
  active: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const tables = await prisma.table.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(tables);
}

export async function POST(request: Request) {
  const auth = await requireApiUser(tableAdminRoles);
  if (!auth.ok) return auth.response;
  if (!canManageTables(auth.user.role)) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a table name." }, { status: 400 });
  }

  const existing = await prisma.table.findMany({ select: { name: true } });
  if (tableNameTaken(parsed.data.name, existing.map((row) => row.name))) {
    return NextResponse.json({ error: "A table with that name already exists." }, { status: 409 });
  }

  const maxSort = await prisma.table.aggregate({ _max: { sortOrder: true } });
  const write = createTableWriteData({
    name: parsed.data.name,
    active: parsed.data.active,
    maxSortOrder: maxSort._max.sortOrder,
  });
  if (!write.ok) return NextResponse.json({ error: write.error }, { status: 400 });

  try {
    const table = await prisma.table.create({ data: write.data });
    await writeAudit(auth.user, {
      action: "CREATE_TABLE",
      entity: "Table",
      entityId: table.id,
      details: { name: table.name, active: table.active },
    });
    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A table with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create table." }, { status: 500 });
  }
}
