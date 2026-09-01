"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth/roles";
import { isLiveStaffAccount } from "@/lib/auth/staff-account";
import { verifyPin } from "@/lib/auth/pin";
import { expireSessionCookie, sessionCookieOptions, signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { changeOwnPin } from "@/services/users";

export async function loginAction(input: {
  userId: string;
  pin: string;
}): Promise<ActionResult<{ home: string }>> {
  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!isLiveStaffAccount(user)) {
      return fail("Staff member not found.");
    }
    const valid = await verifyPin(input.pin, user.pinHash);
    if (!valid) {
      return fail("Wrong PIN.");
    }

    const token = await signSession({
      userId: user.id,
      name: user.name,
      role: user.role,
    });

    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());

    return ok({ home: ROLE_HOME[user.role] });
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}

export async function lockAction() {
  const jar = await cookies();
  expireSessionCookie(jar);
  redirect("/login");
}

export async function changeOwnPinAction(input: {
  pin: string;
  confirmPin: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await changeOwnPin({ userId: user.id, pin: input.pin, confirmPin: input.confirmPin });
    return ok(undefined);
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}
