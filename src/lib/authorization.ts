import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

type AuthOptions = { allowMustChangePin?: boolean };

export type ApiAuthUser = { role: Role; mustChangePin?: boolean };

export function apiAuthDecision(
  user: ApiAuthUser | null | undefined,
  roles?: readonly Role[],
  options: AuthOptions = {},
) {
  if (!user) {
    return { ok: false as const, status: 401 as const, error: "Please sign in to continue." };
  }
  if (user.mustChangePin && !options.allowMustChangePin) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Change your PIN to continue.",
      code: "MUST_CHANGE_PIN" as const,
    };
  }
  if (roles && !roles.includes(user.role)) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "You do not have permission to perform this action.",
    };
  }
  return { ok: true as const };
}

export async function requireUser(roles?: readonly Role[], options: AuthOptions = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePin && !options.allowMustChangePin) redirect("/change-pin");
  if (roles && !roles.includes(session.user.role)) redirect("/unauthorized");
  return session.user;
}

export async function requireApiUser(roles?: readonly Role[], options: AuthOptions = {}) {
  const session = await getServerSession(authOptions);
  const decision = apiAuthDecision(session?.user, roles, options);
  if (!decision.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: decision.error, ...( "code" in decision ? { code: decision.code } : {}) },
        { status: decision.status },
      ),
    };
  }
  return { ok: true as const, user: session!.user };
}
