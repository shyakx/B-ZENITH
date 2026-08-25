"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/authorization";
import { canCloseDay, dayCloseRoles } from "@/lib/business-day";
import { kigaliDateString, kigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { applyBilliardTotals, summarizeSales } from "@/lib/reporting";

export async function closeBusinessDay(formData: FormData) {
  const user = await requireUser(dayCloseRoles);
  const today = kigaliDateString();
  const businessDay = String(formData.get("businessDay") ?? today).slice(0, 10);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  const existing = await prisma.businessDayClose.findUnique({ where: { businessDay } });
  const allowed = canCloseDay(businessDay, today, Boolean(existing));
  if (!allowed.ok) return { error: allowed.error };

  const { start, end } = kigaliRange(businessDay, businessDay, 0);
  const [sales, billiardRows, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { status: { not: "VOIDED" }, createdAt: { gte: start, lt: end } },
      select: {
        createdAt: true,
        paymentMethod: true,
        subtotal: true,
        tax: true,
        discount: true,
        total: true,
        items: { select: { productName: true, quantity: true, returnedQuantity: true, lineSubtotal: true } },
      },
    }),
    prisma.billiardDaySale.findMany({ where: { businessDay }, select: { amount: true } }),
    prisma.expense.aggregate({ where: { incurredAt: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);

  const summary = applyBilliardTotals(
    summarizeSales(
      sales.map((sale) => ({
        createdAt: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        subtotal: sale.subtotal.toNumber(),
        tax: sale.tax.toNumber(),
        discount: sale.discount.toNumber(),
        total: sale.total.toNumber(),
        items: sale.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          returnedQuantity: item.returnedQuantity,
          lineSubtotal: item.lineSubtotal.toNumber(),
        })),
      })),
    ),
    billiardRows.map((row) => ({ businessDay, amount: row.amount.toNumber() })),
  );

  const closed = await prisma.businessDayClose.create({
    data: {
      businessDay,
      closedById: user.id,
      posCount: sales.length,
      posGross: summary.grossTotal,
      posNet: summary.netTotal,
      billiardTotal: billiardRows.reduce((sum, row) => sum + row.amount.toNumber(), 0),
      expenseTotal: expenses._sum.amount?.toNumber() ?? 0,
      note,
    },
  });

  await writeAudit(user, {
    action: "CLOSE_BUSINESS_DAY",
    entity: "BusinessDayClose",
    entityId: closed.id,
    details: { businessDay, posNet: summary.netTotal },
  });
  revalidatePath("/sales");
  revalidatePath("/sales/archive");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
