"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization";
import { businessRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const categories = ["Rent", "Utilities", "Transport", "Supplies", "Maintenance", "Other"] as const;

export async function createExpense(formData: FormData) {
  const user = await requireUser(businessRoles);
  const input = z.object({
    category: z.enum(categories),
    description: z.string().trim().min(3).max(300),
    amount: z.coerce.number().positive().max(100_000_000),
    date: z.coerce.date(),
  }).parse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    date: formData.get("date"),
  });
  const expense = await prisma.expense.create({
    data: {
      category: input.category,
      description: input.description,
      amount: input.amount,
      incurredAt: input.date,
      createdById: user.id,
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE_EXPENSE", entity: "Expense", entityId: expense.id },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
