"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { catalogRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const roles = catalogRoles;
const optional = z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().max(200).optional());
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optional,
  email: z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional()),
  address: optional,
  active: z.coerce.boolean(),
});

const parse = (formData: FormData) => schema.parse({
  name: formData.get("name"),
  phone: formData.get("phone"),
  email: formData.get("email"),
  address: formData.get("address"),
  active: formData.has("active"),
});

export async function createSupplier(formData: FormData) {
  const user = await requireUser(roles);
  const supplier = await prisma.supplier.create({ data: parse(formData) });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE_SUPPLIER", entity: "Supplier", entityId: supplier.id },
  });
  revalidatePath("/suppliers");
}

export async function updateSupplier(id: string, formData: FormData) {
  const user = await requireUser(roles);
  await prisma.supplier.update({ where: { id }, data: parse(formData) });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE_SUPPLIER", entity: "Supplier", entityId: id },
  });
  revalidatePath("/suppliers");
}
