"use server";

import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function createEmployee(formData: FormData) {
  const actor = await requireUser(["OWNER"]);
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().transform((value) => value.toLowerCase()),
    role: z.nativeEnum(Role),
    password: z.string().min(8).max(128),
  }).parse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  const employee = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hash(input.password, 12),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE_EMPLOYEE",
      entity: "User",
      entityId: employee.id,
      details: { email: employee.email, role: employee.role },
    },
  });
  revalidatePath("/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  const actor = await requireUser(["OWNER"]);
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    role: z.nativeEnum(Role),
    active: z.coerce.boolean(),
    password: z.string().max(128).optional(),
  }).parse({
    name: formData.get("name"),
    role: formData.get("role"),
    active: formData.has("active"),
    password: String(formData.get("password") ?? "") || undefined,
  });
  if (id === actor.id && !input.active) throw new Error("You cannot deactivate your own account.");
  const current = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (current.role === "OWNER" && current.active && (input.role !== "OWNER" || !input.active)) {
    const otherOwners = await prisma.user.count({ where: { role: "OWNER", active: true, NOT: { id } } });
    if (otherOwners === 0) throw new Error("The last owner account cannot be removed.");
  }
  await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      role: input.role,
      active: input.active,
      ...(input.password ? { passwordHash: await hash(z.string().min(8).parse(input.password), 12) } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE_EMPLOYEE",
      entity: "User",
      entityId: id,
      details: { role: input.role, active: input.active, passwordChanged: Boolean(input.password) },
    },
  });
  revalidatePath("/employees");
}
