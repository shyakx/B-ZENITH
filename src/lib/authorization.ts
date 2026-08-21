import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

type AuthOptions = { allowMustChangePin?: boolean };

export async function requireUser(roles?: readonly Role[], options: AuthOptions = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePin && !options.allowMustChangePin) redirect("/change-pin");
  if (roles && !roles.includes(session.user.role)) redirect("/unauthorized");
  return session.user;
}

export async function requireApiUser(roles?: readonly Role[], options: AuthOptions = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  }
  if (session.user.mustChangePin && !options.allowMustChangePin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Change your PIN to continue.", code: "MUST_CHANGE_PIN" }, { status: 403 }),
    };
  }
  if (roles && !roles.includes(session.user.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 }) };
  }
  return { ok: true as const, user: session.user };
}
