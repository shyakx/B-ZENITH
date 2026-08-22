"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authorization";
import { parseBilliardAmount } from "@/lib/billiard";
import { kigaliDateString } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { billiardRoles } from "@/lib/roles";

export async function saveTodayBilliardSales(formData: FormData) {
  const user = await requireUser(billiardRoles);
  const amount = parseBilliardAmount(formData.get("amount"));
  if (amount == null) {
    return { error: "Enter today’s billiard sales as a positive amount in RWF." };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  const businessDay = kigaliDateString();

  const sale = await prisma.billiardDaySale.upsert({
    where: { businessDay_operatorId: { businessDay, operatorId: user.id } },
    create: { businessDay, operatorId: user.id, amount, note },
    update: { amount, note },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAVE_BILLIARD_DAY_SALE",
      entity: "BilliardDaySale",
      entityId: sale.id,
      details: { businessDay, amount },
    },
  });

  revalidatePath("/billiard");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
