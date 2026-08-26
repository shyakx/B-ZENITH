import type { Role } from "@prisma/client";
import { DELETED_USERNAME_PREFIX } from "@/lib/employee-update";
import { loginRoles } from "@/lib/roles";

export const LOGIN_STAFF_PATH = "/api/login/staff";
export const LOGIN_STAFF_CACHE_CONTROL = "no-store";

export const loginStaffRoles = loginRoles.map((item) => item.id);
export type LoginStaffRole = (typeof loginStaffRoles)[number];

export const LOGIN_STAFF_PUBLIC_FIELDS = [
  "username",
  "name",
  "firstName",
  "lastName",
  "role",
] as const;

export type PublicLoginStaff = {
  username: string;
  name: string;
  firstName: string;
  lastName: string;
  role: Role;
};

const LOGIN_STAFF_ROLE_SET = new Set<string>(loginStaffRoles);

export function parseLoginStaffRole(value: string | null | undefined): LoginStaffRole | null {
  if (!value || !LOGIN_STAFF_ROLE_SET.has(value)) return null;
  return value as LoginStaffRole;
}

export function loginStaffQuery(role: LoginStaffRole) {
  return {
    where: {
      active: true,
      role,
      NOT: { username: { startsWith: DELETED_USERNAME_PREFIX } },
    },
    select: {
      username: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
    },
    orderBy: { name: "asc" as const },
  };
}

export function toPublicLoginStaff(row: PublicLoginStaff): PublicLoginStaff {
  return {
    username: row.username,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
  };
}

export async function listPublicLoginStaff(
  roleParam: string | null,
  findMany: (query: ReturnType<typeof loginStaffQuery>) => Promise<PublicLoginStaff[]>,
): Promise<{ ok: true; staff: PublicLoginStaff[] } | { ok: false; status: 400; error: string }> {
  const role = parseLoginStaffRole(roleParam);
  if (!role) {
    return { ok: false, status: 400, error: "Invalid role." };
  }
  const rows = await findMany(loginStaffQuery(role));
  return { ok: true, staff: rows.map(toPublicLoginStaff) };
}
