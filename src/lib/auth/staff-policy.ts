import type { Role } from "@/lib/auth/roles";

/**
 * Staff-role policy.
 *
 * OWNER owns the business and may create, promote, demote, and delete OWNER accounts.
 * ADMIN manages WAITER / CASHIER / MANAGER / ADMIN. ADMIN must not grant OWNER once
 * an owner exists. Bootstrap: if there is no active owner, ADMIN may create the first
 * OWNER so the business can appoint one without being locked out.
 */
export const ADMIN_ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MANAGER", "CASHIER", "WAITER"];
export const OWNER_ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER"];

export function assignableRoles(actorRole: Role, activeOwnerCount: number): Role[] {
  if (actorRole === "OWNER") return [...OWNER_ASSIGNABLE_ROLES];
  if (actorRole === "ADMIN") {
    return activeOwnerCount === 0 ? ["OWNER", ...ADMIN_ASSIGNABLE_ROLES] : [...ADMIN_ASSIGNABLE_ROLES];
  }
  return [];
}

export function canAssignRole(
  actorRole: Role,
  targetRole: Role,
  options: { activeOwnerCount: number; currentRole?: Role } = { activeOwnerCount: 0 },
): boolean {
  if (targetRole === "OWNER") {
    if (actorRole === "OWNER") return true;
    return (
      actorRole === "ADMIN" &&
      options.activeOwnerCount === 0 &&
      options.currentRole === undefined
    );
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

  return {
    assignableRoles: assignableRoles(actor.role, activeOwnerCount),
    canResetPin: !ownerLocked,
    canChangeActive: !isSelf && !ownerLocked && !lastOwner,
    canDelete: !isSelf && !ownerLocked && !lastOwner,
  };
}
