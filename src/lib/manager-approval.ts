import type { Role } from "@prisma/client";
import { pinSchema, verifyAndRecordPinAttempt } from "@/lib/pin";
import { prisma } from "@/lib/prisma";
import { managerRoles } from "@/lib/roles";

export class ApprovalError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 409 = 403,
  ) {
    super(message);
    this.name = "ApprovalError";
  }
}

export type ApprovedManager = {
  id: string;
  name: string;
  username: string;
  role: Role;
};

const APPROVAL_FAILED = "Manager approval failed.";

/**
 * Self-approval:
 * - Waiter-requested actions: requester !== approver (a waiter cannot approve).
 * - Manager-initiated actions: the logged-in manager may approve with their own PIN.
 *   Presence of a manager session is never enough; the PIN must still verify.
 */
export function managerMaySelfApprove(requesterRole: Role | string) {
  return (managerRoles as readonly string[]).includes(requesterRole);
}

export async function verifyManagerApproval(input: {
  managerUserId: string;
  managerPin: string;
  requesterId: string;
  requesterRole: Role | string;
  allowSelfApproval: boolean;
  action?: string;
}): Promise<ApprovedManager> {
  const pinParsed = pinSchema.safeParse(input.managerPin);
  if (!pinParsed.success) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }

  const manager = await prisma.user.findUnique({
    where: { id: input.managerUserId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
    },
  });

  if (!manager?.active) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }
  if (!(managerRoles as readonly string[]).includes(manager.role)) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }
  if (!input.allowSelfApproval && manager.id === input.requesterId) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }
  if (!managerMaySelfApprove(input.requesterRole) && manager.id === input.requesterId) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }

  const verified = await verifyAndRecordPinAttempt(manager.id, pinParsed.data);
  if (!verified.ok) {
    throw new ApprovalError(APPROVAL_FAILED, 403);
  }

  return {
    id: manager.id,
    name: manager.name,
    username: manager.username,
    role: manager.role,
  };
}

export const managerApprovalBodySchema = {
  managerUserId: true,
  managerPin: true,
} as const;
