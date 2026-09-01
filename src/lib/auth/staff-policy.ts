import type { Role } from "@/lib/auth/roles";

/**
 * Staff-role policy.
 *
 * OWNER and ADMIN have the same staff-management power, except:
 * OWNER must not delete an ADMIN account, and the last active OWNER cannot be
 * deleted, deactivated, or demoted.
 */
export const ADMIN_ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"];
export const OWNER_ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"];

export function assignableRoles(actorRole: Role, _activeOwnerCount = 0): Role[] {
  if (actorRole === "OWNER" || actorRole === "ADMIN") return [...OWNER_ASSIGNABLE_ROLES];
  return [];
}

export function canAssignRole(
  actorRole: Role,
  targetRole: Role,
  options: { activeOwnerCount: number; currentRole?: Role } = { activeOwnerCount: 0 },
): boolean {
  return assignableRoles(actorRole, options.activeOwnerCount).includes(targetRole);
}

export function isLastActiveOwner(input: {
  role: Role;
  active: boolean;
  deleted?: boolean;
  activeOwnerCount: number;
}): boolean {
  return input.role === "OWNER" && input.active && !input.deleted && input.activeOwnerCount <= 1;
}

export function lastOwnerGuardMessage(action: "deactivate" | "delete" | "demote"): string {
  switch (action) {
    case "deactivate":
      return "The last active owner cannot be deactivated. Appoint another owner first.";
    case "delete":
      return "The last active owner cannot be deleted. Appoint another owner first.";
    case "demote":
      return "The last active owner cannot have their role changed. Appoint another owner first.";
  }
}

export function canManageOwnerAccount(actorRole: Role, targetRole: Role): boolean {
  if (targetRole !== "OWNER") return true;
  return actorRole === "OWNER" || actorRole === "ADMIN";
}

export function canDeleteStaffAccount(actorRole: Role, targetRole: Role): boolean {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") return false;
  if (actorRole === "OWNER" && targetRole === "ADMIN") return false;
  return true;
}

export function staffActionFlags(
  actor: { id: string; role: Role },
  user: { id: string; role: Role; active: boolean },
  activeOwnerCount: number,
) {
  const isSelf = actor.id === user.id;
  const ownerLocked = !canManageOwnerAccount(actor.role, user.role);
  const lastOwner = isLastActiveOwner({
    role: user.role,
    active: user.active,
    activeOwnerCount,
  });

  const roles = assignableRoles(actor.role, activeOwnerCount);

  return {
    assignableRoles: roles,
    canResetPin: !ownerLocked,
    canChangeActive: !isSelf && !ownerLocked && !lastOwner,
    canDelete: !isSelf && canDeleteStaffAccount(actor.role, user.role) && !lastOwner,
  };
}
