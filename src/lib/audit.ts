import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditActor = {
  id: string;
  username: string;
  name?: string | null;
  role: Role;
};

export async function writeAudit(
  actor: AuditActor,
  entry: { action: string; entity: string; entityId?: string | null; details?: Prisma.InputJsonValue },
  db: { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } } = prisma,
) {
  await db.auditLog.create({
    data: {
      userId: actor.id,
      actorUsername: actor.username,
      actorName: actor.name ?? actor.username,
      actorRole: actor.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details: entry.details,
    },
  });
}
