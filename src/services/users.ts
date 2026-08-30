import { Role } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { hashPin, isValidPin } from "@/lib/auth/pin";
import { isRole } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const staffSelect = {
  id: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

function requireStaffName(value: string) {
  const name = value.trim();
  if (name.length < 2) throw new AppError("Staff name is required.");
  return name;
}

function requireStaffRole(value: string): Role {
  if (!isRole(value)) throw new AppError("Choose a valid role.");
  return value;
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: staffSelect,
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
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
    where: { active: true },
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

  const user = await prisma.user.create({
    data: {
      name,
      role,
      pinHash: await hashPin(input.pin),
    },
    select: staffSelect,
  });

  await writeAudit({
    userId: input.actorId,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    after: { name, role },
  });

  return user;
}

export async function updateUser(input: {
  id: string;
  name?: string;
  role?: string;
  active?: boolean;
  actorId: string;
}) {
  const current = await prisma.user.findUnique({
    where: { id: input.id },
    select: staffSelect,
  });
  if (!current) throw new AppError("Staff member not found.");

  const name = input.name !== undefined ? requireStaffName(input.name) : current.name;
  const role = input.role !== undefined ? requireStaffRole(input.role) : current.role;
  const active = input.active !== undefined ? input.active : current.active;

  if (current.id === input.actorId && !active) {
    throw new AppError("You cannot deactivate your own account.");
  }

  const updated = await prisma.user.update({
    where: { id: input.id },
    data: {
      name,
      role,
      active,
    },
    select: staffSelect,
  });

  if (current.role !== updated.role) {
    await writeAudit({
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
      userId: input.actorId,
      action: updated.active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entity: "User",
      entityId: updated.id,
      before: { active: current.active, name: current.name, role: current.role },
      after: { active: updated.active, name: updated.name, role: updated.role },
    });
  }

  return updated;
}

export async function changePin(input: { id: string; pin: string; actorId: string }) {
  if (!isValidPin(input.pin)) throw new AppError("PIN must be 4 to 6 digits.");
  const user = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, name: true },
  });
  if (!user) throw new AppError("Staff member not found.");

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
