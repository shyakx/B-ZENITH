import type { Role } from "@/lib/auth/roles";

/**
 * Staff-role policy.
 *
 * OWNER owns the business and may create, promote, demote, and delete OWNER accounts.
 * ADMIN may create OWNER accounts and manage WAITER / CASHIER / MANAGER / ADMIN.
 * ADMIN must not promote existing staff to OWNER, or change / delete an OWNER account.
 */
export const ADMIN_ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"];
export const OWNER_ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"];

export function assignableRoles(actorRole: Role, _activeOwnerCount = 0): Role[] {
  if (actorRole === "OWNER") return [...OWNER_ASSIGNABLE_ROLES];
  if (actorRole === "ADMIN") return [...ADMIN_ASSIGNABLE_ROLES];
  return [];
}

export function canAssignRole(
  actorRole: Role,
  targetRole: Role,
  options: { activeOwnerCount: number; currentRole?: Role } = { activeOwnerCount: 0 },
): boolean {
  if (targetRole === "OWNER") {
    if (actorRole === "OWNER") return true;
    return actorRole === "ADMIN" && options.currentRole === undefined;
  }

  if (options.currentRole === "OWNER") {
    return actorRole === "OWNER";
  }

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
  return actorRole === "OWNER";
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
    assignableRoles: actor.role === "ADMIN" ? roles.filter((role) => role !== "OWNER") : roles,
    canResetPin: !ownerLocked,
    canChangeActive: !isSelf && !ownerLocked && !lastOwner,
    canDelete: !isSelf && !ownerLocked && !lastOwner,
  };
}
