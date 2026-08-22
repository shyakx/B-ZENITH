"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const optional = z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().max(200).optional());

export async function updateSettings(formData: FormData) {
  const user = await requireUser(userAdminRoles);
  const input = z.object({
    businessName: z.string().trim().min(2).max(120),
    phone: optional,
    email: z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional()),
    address: optional,
    receiptFooter: z.string().trim().min(2).max(300),
    taxEnabled: z.coerce.boolean(),
    taxRate: z.coerce.number().min(0).max(100),
    lowStockEnabled: z.coerce.boolean(),
    defaultReorderLevel: z.coerce.number().int().min(0).max(1_000_000),
  }).parse({
    businessName: formData.get("businessName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    receiptFooter: formData.get("receiptFooter"),
    taxEnabled: formData.has("taxEnabled"),
    taxRate: formData.get("taxRate") || "0",
    lowStockEnabled: formData.has("lowStockEnabled"),
    defaultReorderLevel: formData.get("defaultReorderLevel") || "5",
  });
  await prisma.$transaction([
    prisma.businessSettings.upsert({
      where: { id: "default" },
      update: { ...input, timezone: "Africa/Kigali", currency: "RWF" },
      create: { id: "default", ...input, timezone: "Africa/Kigali", currency: "RWF" },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        actorUsername: user.username,
        actorName: user.name ?? "",
        actorRole: user.role,
        action: "UPDATE_SETTINGS",
        entity: "BusinessSettings",
        entityId: "default",
      },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/print/receipt/[saleId]", "page");
}
