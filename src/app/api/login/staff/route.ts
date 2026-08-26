import { NextResponse } from "next/server";
import {
  LOGIN_STAFF_CACHE_CONTROL,
  listPublicLoginStaff,
} from "@/lib/login-staff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": LOGIN_STAFF_CACHE_CONTROL,
  Pragma: "no-cache",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await listPublicLoginStaff(searchParams.get("role"), (query) =>
    prisma.user.findMany(query),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: noStoreHeaders });
  }

  return NextResponse.json(result.staff, { headers: noStoreHeaders });
}
