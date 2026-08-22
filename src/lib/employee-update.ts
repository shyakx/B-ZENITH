import { Role } from "@prisma/client";
import { z } from "zod";
import { displayName } from "@/lib/staff";

export const employeeRoleSchema = z.nativeEnum(Role);

export const LAST_OWNER_MESSAGE =
  "This is the only active owner. Another active owner must exist before this account can be changed to another role.";

export const INVALID_ROLE_MESSAGE = "You cannot assign that role.";

export const DELETE_SELF_MESSAGE = "You cannot delete your own account.";

export const OWNER_DELETE_OWNER_MESSAGE = "Only an admin can delete an owner account.";

export const DELETED_USERNAME_PREFIX = "__del__.";

export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === "OWNER" || actorRole === "ADMIN") return ["ADMIN", "OWNER", "MANAGER", "WAITER"];
  return [];
}

export function isLastActiveOwner(targetRole: Role, targetActive: boolean, otherActiveOwnerCount: number) {
  return targetRole === "OWNER" && targetActive && otherActiveOwnerCount === 0;
}

export type EmployeeUpdateDecision =
  | { ok: true }
  | { ok: false; error: string };

export function authorizeEmployeeUpdate(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  targetActive: boolean;
  nextRole: Role;
  nextActive: boolean;
  otherActiveOwnerCount: number;
}): EmployeeUpdateDecision {
  if (!assignableRoles(input.actorRole).includes(input.nextRole) && input.nextRole !== input.targetRole) {
    return { ok: false, error: INVALID_ROLE_MESSAGE };
  }
  if (input.targetId === input.actorId && !input.nextActive) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }
  if (
    isLastActiveOwner(input.targetRole, input.targetActive, input.otherActiveOwnerCount) &&
    (input.nextRole !== "OWNER" || !input.nextActive)
  ) {
    return { ok: false, error: LAST_OWNER_MESSAGE };
  }
  return { ok: true };
}

export function authorizeEmployeeDelete(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  targetActive: boolean;
  otherActiveOwnerCount: number;
}): EmployeeUpdateDecision {
  if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") {
    return { ok: false, error: "You cannot delete users." };
  }
  if (input.targetId === input.actorId) {
    return { ok: false, error: DELETE_SELF_MESSAGE };
  }
  if (input.actorRole !== "ADMIN" && input.targetRole === "OWNER") {
    return { ok: false, error: OWNER_DELETE_OWNER_MESSAGE };
  }
  if (isLastActiveOwner(input.targetRole, input.targetActive, input.otherActiveOwnerCount)) {
    return { ok: false, error: LAST_OWNER_MESSAGE };
  }
  return { ok: true };
}

export function employeeUpdateWriteData(input: {
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  active: boolean;
}) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    name: displayName(input.firstName, input.lastName),
    username: input.username,
    role: input.role,
    active: input.active,
  };
}
