"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/authorization";
import {
  DELETED_USERNAME_PREFIX,
  assignableRoles,
  authorizeEmployeeDelete,
  authorizeEmployeeUpdate,
  employeeRoleSchema,
  employeeUpdateWriteData,
} from "@/lib/employee-update";
import { userAdminRoles } from "@/lib/roles";
import { pinSchema } from "@/lib/pin";
import { prisma } from "@/lib/prisma";
import { displayName, staffEmail, usernameSchema } from "@/lib/staff";

const managers = userAdminRoles;

function formError(error: z.ZodError) {
  return { error: error.issues[0]?.message ?? "Check the form and try again." };
}

async function hashPin(value: string) {
  return hash(pinSchema.parse(value), 12);
}

export async function createEmployee(formData: FormData) {
  const actor = await requireUser(managers);
  const parsed = z.object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    username: usernameSchema,
    role: employeeRoleSchema,
    pin: pinSchema,
    active: z.coerce.boolean(),
  }).safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    role: formData.get("role"),
    pin: formData.get("pin"),
    active: formData.has("active"),
  });
  if (!parsed.success) return formError(parsed.error);
  const input = parsed.data;
  if (!assignableRoles(actor.role).includes(input.role)) {
    return { error: "You cannot assign that role." };
  }
  const email = staffEmail(input.username);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email }] },
  });
  if (existing) return { error: "That username is already in use." };

  const employee = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      name: displayName(input.firstName, input.lastName),
      username: input.username,
      email,
      role: input.role,
      active: input.active,
      passwordHash: await hash(randomBytes(32).toString("hex"), 10),
      pinHash: await hashPin(input.pin),
      mustChangePin: true,
    },
  });
  await writeAudit(actor, {
    action: "CREATE_USER",
    entity: "User",
    entityId: employee.id,
    details: { username: employee.username, role: employee.role },
  });
  revalidatePath("/employees");
  return {};
}

export async function updateEmployee(id: string, formData: FormData) {
  const actor = await requireUser(managers);
  const parsed = z.object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    username: usernameSchema,
    role: employeeRoleSchema,
    active: z.coerce.boolean(),
    pin: z.string().optional(),
  }).safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    role: formData.get("role"),
    active: formData.has("active"),
    pin: String(formData.get("pin") ?? "") || undefined,
  });
  if (!parsed.success) return formError(parsed.error);
  const input = parsed.data;
  if (input.pin) {
    const pin = pinSchema.safeParse(input.pin);
    if (!pin.success) return formError(pin.error);
  }
  const current = await prisma.user.findUniqueOrThrow({ where: { id } });
  const otherActiveOwnerCount = await prisma.user.count({
    where: { role: "OWNER", active: true, NOT: { id } },
  });
  const allowed = authorizeEmployeeUpdate({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: id,
    targetRole: current.role,
    targetActive: current.active,
    nextRole: input.role,
    nextActive: input.active,
    otherActiveOwnerCount,
  });
  if (!allowed.ok) return { error: allowed.error };
  const usernameTaken = await prisma.user.findFirst({
    where: { username: input.username, NOT: { id } },
  });
  if (usernameTaken) return { error: "That username is already in use." };

  await prisma.user.update({
    where: { id },
    data: {
      ...employeeUpdateWriteData(input),
      ...(input.pin
        ? {
            pinHash: await hashPin(input.pin),
            mustChangePin: true,
            pinFailedAttempts: 0,
            pinLockedUntil: null,
          }
        : {}),
    },
  });
  await writeAudit(actor, {
    action: input.pin ? "RESET_USER_PIN" : "UPDATE_USER",
    entity: "User",
    entityId: id,
    details: {
      username: input.username,
      role: input.role,
      active: input.active,
      pinReset: Boolean(input.pin),
    },
  });
  revalidatePath("/employees");
  return {};
}

export async function deleteEmployee(id: string) {
  const actor = await requireUser(managers);
  const current = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      _count: {
        select: { sales: true, purchases: true, expenses: true, returns: true, movements: true },
      },
    },
  });
  const otherActiveOwnerCount = await prisma.user.count({
    where: { role: "OWNER", active: true, NOT: { id } },
  });
  const allowed = authorizeEmployeeDelete({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: id,
    targetRole: current.role,
    targetActive: current.active,
    otherActiveOwnerCount,
  });
  if (!allowed.ok) return { error: allowed.error };

  const hasHistory = Object.values(current._count).some((count) => count > 0);
  await writeAudit(actor, {
    action: "DELETE_USER",
    entity: "User",
    entityId: id,
    details: { username: current.username, role: current.role, keptHistory: hasHistory },
  });

  if (hasHistory) {
    await prisma.user.update({
      where: { id },
      data: {
        active: false,
        pinHash: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        mustChangePin: false,
        username: `${DELETED_USERNAME_PREFIX}${id}`,
        email: `deleted.${id}@staff.bzenith.local`,
      },
    });
  } else {
    await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
    await prisma.user.delete({ where: { id } });
  }

  revalidatePath("/employees");
  return {};
}
