import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const STAFF_LIMIT = 20;
const STAFF_WINDOW_MS = 60_000;
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const limited = rateLimit(`staff:${clientIp(request)}`, STAFF_LIMIT, STAFF_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const role = new URL(request.url).searchParams.get("role");
  if (!role || !Object.values(Role).includes(role as Role)) {
    return NextResponse.json({ error: "Choose a role first." }, { status: 400, headers: NO_STORE });
  }

  try {
    const staff = await prisma.user.findMany({
      where: { active: true, role: role as Role, pinHash: { not: null } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { username: true, firstName: true, lastName: true, name: true, role: true },
    });
    return NextResponse.json(staff, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Unable to load staff right now." }, { status: 503, headers: NO_STORE });
  }
}
