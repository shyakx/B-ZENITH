import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { businessRoles, tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await requireApiUser(tillRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const approvers = searchParams.get("approvers") === "1";

  const staff = await prisma.user.findMany({
    where: {
      active: true,
      ...(approvers
        ? { role: { in: [...businessRoles] } }
        : role
          ? { role: role as Role }
          : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}
