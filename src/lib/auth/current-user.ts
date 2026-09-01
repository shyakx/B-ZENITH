import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME, type Permission, hasPermission, type Role } from "@/lib/auth/roles";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await readSessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true, active: true },
  });

  if (!user || !user.active) return null;

  return { id: user.id, name: user.name, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(ROLE_HOME[user.role]);
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AppError("You are not allowed to do this.", "FORBIDDEN");
  }
  return user;
}
