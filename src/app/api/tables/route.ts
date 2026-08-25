import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const tables = await prisma.table.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(tables);
}
