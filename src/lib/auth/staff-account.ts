import { isRole, type Role } from "@/lib/auth/roles";

export type StaffAccountState = {
  active: boolean;
  deletedAt: Date | null;
  role: string;
};

/**
 * Live staff may log in and keep a session.
 * Deactivated or tombstoned accounts must not authenticate, even with a leftover cookie.
 */
export function isLiveStaffAccount(
  user: StaffAccountState | null | undefined,
): user is StaffAccountState & { active: true; deletedAt: null; role: Role } {
  return Boolean(user && user.active && !user.deletedAt && isRole(user.role));
}
