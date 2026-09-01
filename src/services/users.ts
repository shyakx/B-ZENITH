import { Prisma, Role } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { hashPin, isValidPin, retirePinHash } from "@/lib/auth/pin";
import { isRole } from "@/lib/auth/roles";
import {
  canAssignRole,
  canManageOwnerAccount,
  isLastActiveOwner,
  lastOwnerGuardMessage,
} from "@/lib/auth/staff-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

const staffSelect = {
  id: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

const livingStaff = { deletedAt: null } as const;

/** Serializes owner create / demote / deactivate / delete so at least one live OWNER remains. */
const OWNER_SAFETY_LOCK = 872514001;

function requireStaffName(value: string) {
  const name = value.trim();
  if (name.length < 2) throw new AppError("Staff name is required.");
  return name;
}

function requireStaffRole(value: string): Role {
  if (!isRole(value)) throw new AppError("Choose a valid role.");
  return value;
}

function auditTx(db: Db) {
  return db === prisma ? undefined : (db as Prisma.TransactionClient);
}

async function loadActor(db: Db, actorId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorId, active: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!actor || !isRole(actor.role)) throw new AppError("Staff member not found.");
  return actor;
}

async function countActiveOwnersFrom(db: Db) {
  return db.user.count({
    where: { role: "OWNER", active: true, deletedAt: null },
  });
}

async function withOwnerSafety<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OWNER_SAFETY_LOCK})`;
    return fn(tx);
  });
}

function affectsOwnerRoster(currentRole: Role, nextRole: Role) {
  return currentRole === "OWNER" || nextRole === "OWNER";
}

export async function countActiveOwners() {
  return countActiveOwnersFrom(prisma);
}

export async function listUsers() {
  return prisma.user.findMany({
    where: livingStaff,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: staffSelect,
  });
}

export async function getUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, ...livingStaff },
    select: staffSelect,
  });
}

export async function listUserAudit(userId: string, take = 20) {
  return prisma.auditLog.findMany({
    where: { entity: "User", entityId: userId },
    take,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function listStaffForLogin() {
  return prisma.user.findMany({
    where: { active: true, deletedAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
}

export async function createUser(input: {
  name: string;
  role: string;
  pin: string;
  actorId: string;
}) {
  const name = requireStaffName(input.name);
  const role = requireStaffRole(input.role);
  if (!isValidPin(input.pin)) throw new AppError("PIN must be 4 to 6 digits.");
  const pinHash = await hashPin(input.pin);

  const persist = async (db: Db) => {
    const actor = await loadActor(db, input.actorId);
    const activeOwnerCount = await countActiveOwnersFrom(db);
    if (!canAssignRole(actor.role, role, { activeOwnerCount })) {
      throw new AppError(
        role === "OWNER"
          ? "You are not allowed to create an owner account."
          : "You are not allowed to assign that role.",
      );
    }

    const user = await db.user.create({
      data: { name, role, pinHash },
      select: staffSelect,
    });

    await writeAudit({
      tx: auditTx(db),
      userId: input.actorId,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      after: { name, role },
    });

    return user;
  };

  return role === "OWNER" ? withOwnerSafety(persist) : persist(prisma);
}

export async function updateUser(input: {
  id: string;
  name?: string;
  role?: string;
  active?: boolean;
  actorId: string;
}) {
  if (input.name !== undefined) requireStaffName(input.name);
  if (input.role !== undefined) requireStaffRole(input.role);

  const persist = async (db: Db) => {
    const actor = await loadActor(db, input.actorId);
    const current = await db.user.findFirst({
      where: { id: input.id, ...livingStaff },
      select: staffSelect,
    });
    if (!current) throw new AppError("Staff member not found.");

    const name = input.name !== undefined ? requireStaffName(input.name) : current.name;
    const role = input.role !== undefined ? requireStaffRole(input.role) : current.role;
    const active = input.active !== undefined ? input.active : current.active;
    const activeOwnerCount = await countActiveOwnersFrom(db);
    const lastOwner = isLastActiveOwner({
      role: current.role,
      active: current.active,
      activeOwnerCount,
    });

    if (!canManageOwnerAccount(actor.role, current.role) && (role !== current.role || active !== current.active)) {
      throw new AppError("Only an owner can change an owner account.");
    }

    if (lastOwner && current.role === "OWNER" && role !== "OWNER") {
      throw new AppError(lastOwnerGuardMessage("demote"));
    }

    if (lastOwner && current.active && !active) {
      throw new AppError(lastOwnerGuardMessage("deactivate"));
    }

    if (current.id === input.actorId && !active) {
      throw new AppError("You cannot deactivate your own account.");
    }

    if (role !== current.role && !canAssignRole(actor.role, role, { activeOwnerCount, currentRole: current.role })) {
      throw new AppError(
        role === "OWNER" || current.role === "OWNER"
          ? "Only an owner can create, promote, or demote an owner account."
          : "You are not allowed to assign that role.",
      );
    }

    const updated = await db.user.update({
      where: { id: input.id },
      data: { name, role, active },
      select: staffSelect,
    });

    if (current.role !== updated.role) {
      await writeAudit({
        tx: auditTx(db),
        userId: input.actorId,
        action: "PERMISSION_CHANGED",
        entity: "User",
        entityId: updated.id,
        before: { role: current.role, name: current.name },
        after: { role: updated.role, name: updated.name },
      });
    }

    if (current.active !== updated.active) {
      await writeAudit({
        tx: auditTx(db),
        userId: input.actorId,
        action: updated.active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entity: "User",
        entityId: updated.id,
        before: { active: current.active, name: current.name, role: current.role },
        after: { active: updated.active, name: updated.name, role: updated.role },
      });
    }

    return updated;
  };

  const peek = await prisma.user.findFirst({
    where: { id: input.id, ...livingStaff },
    select: { role: true },
  });
  if (!peek) throw new AppError("Staff member not found.");
  const nextRole = input.role !== undefined ? requireStaffRole(input.role) : peek.role;
  if (affectsOwnerRoster(peek.role, nextRole)) {
    return withOwnerSafety(persist);
  }
  return persist(prisma);
}

export async function changePin(input: { id: string; pin: string; actorId: string }) {
  if (!isValidPin(input.pin)) throw new AppError("PIN must be 4 to 6 digits.");
  const actor = await loadActor(prisma, input.actorId);
  const user = await prisma.user.findFirst({
    where: { id: input.id, ...livingStaff },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new AppError("Staff member not found.");
  if (!canManageOwnerAccount(actor.role, user.role)) {
    throw new AppError("Only an owner can reset an owner PIN.");
  }

  await prisma.user.update({
    where: { id: input.id },
    data: { pinHash: await hashPin(input.pin) },
  });

  await writeAudit({
    userId: input.actorId,
    action: "PIN_CHANGED",
    entity: "User",
    entityId: input.id,
    after: { name: user.name },
  });
}

export async function changeOwnPin(input: { userId: string; pin: string; confirmPin: string }) {
  if (input.pin !== input.confirmPin) throw new AppError("Both PINs must match.");
  await changePin({ id: input.userId, pin: input.pin, actorId: input.userId });
}

export async function deleteStaff(input: { id: string; actorId: string }) {
  const pinHash = await retirePinHash();

  const persist = async (db: Db) => {
    const actor = await loadActor(db, input.actorId);
    const current = await db.user.findFirst({
      where: { id: input.id, ...livingStaff },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!current) throw new AppError("Staff member not found.");
    if (!canManageOwnerAccount(actor.role, current.role)) {
      throw new AppError("Only an owner can delete an owner account.");
    }

    const activeOwnerCount = await countActiveOwnersFrom(db);
    if (
      isLastActiveOwner({
        role: current.role,
        active: current.active,
        activeOwnerCount,
      })
    ) {
      throw new AppError(lastOwnerGuardMessage("delete"));
    }
    if (current.id === input.actorId) {
      throw new AppError("You cannot delete your own account.");
    }

    await db.user.update({
      where: { id: current.id },
      data: {
        active: false,
        deletedAt: new Date(),
        pinHash,
      },
    });

    await writeAudit({
      tx: auditTx(db),
      userId: input.actorId,
      action: "USER_DELETED",
      entity: "User",
      entityId: current.id,
      before: { name: current.name, role: current.role, active: current.active },
      after: { name: current.name, role: current.role },
    });
  };

  const peek = await prisma.user.findFirst({
    where: { id: input.id, ...livingStaff },
    select: { role: true },
  });
  if (!peek) throw new AppError("Staff member not found.");
  if (peek.role === "OWNER") {
    return withOwnerSafety(persist);
  }
  return persist(prisma);
}
