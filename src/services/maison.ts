import { PaymentStatus } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { paymentStatusAfterAmount } from "@/lib/domain/payments";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function listMaisonRecords() {
  return prisma.maisonRecord.findMany({
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });
}

export async function createMaisonRecord(input: {
  customerName: string;
  customerPhone?: string;
  reference?: string;
  date: Date;
  amount: number;
  paidAmount?: number;
  notes?: string;
  staffId: string;
}) {
  const customerName = input.customerName.trim();
  if (customerName.length < 2) throw new AppError("Customer name is required.");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError("Amount must be a positive whole number.");
  }
  const paidAmount = input.paidAmount ?? 0;
  if (!Number.isInteger(paidAmount) || paidAmount < 0 || paidAmount > input.amount) {
    throw new AppError("Paid amount is not valid.");
  }

  const record = await prisma.maisonRecord.create({
    data: {
      customerName,
      customerPhone: input.customerPhone?.trim() || null,
      reference: input.reference?.trim() || null,
      date: input.date,
      amount: input.amount,
      paidAmount,
      paymentStatus: paymentStatusAfterAmount(input.amount, paidAmount),
      notes: input.notes?.trim() || null,
      staffId: input.staffId,
    },
  });

  await writeAudit({
    userId: input.staffId,
    action: "MAISON_CREATED",
    entity: "MaisonRecord",
    entityId: record.id,
    after: { customerName, amount: input.amount, paidAmount },
  });

  return record;
}

export async function recordMaisonPayment(input: {
  id: string;
  amount: number;
  staffId: string;
}) {
  const record = await prisma.maisonRecord.findUnique({ where: { id: input.id } });
  if (!record) throw new AppError("Maison record not found.");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError("Payment amount must be a positive whole number.");
  }
  const nextPaid = record.paidAmount + input.amount;
  if (nextPaid > record.amount) {
    throw new AppError("Payment is larger than the remaining balance.");
  }

  const updated = await prisma.maisonRecord.update({
    where: { id: record.id },
    data: {
      paidAmount: nextPaid,
      paymentStatus: paymentStatusAfterAmount(record.amount, nextPaid),
    },
  });

  await writeAudit({
    userId: input.staffId,
    action: "MAISON_PAYMENT",
    entity: "MaisonRecord",
    entityId: record.id,
    before: { paidAmount: record.paidAmount, paymentStatus: record.paymentStatus },
    after: { paidAmount: nextPaid, paymentStatus: updated.paymentStatus },
  });

  return updated;
}

export function maisonBalance(amount: number, paidAmount: number) {
  return Math.max(0, amount - paidAmount);
}

export const maisonOpenStatuses: PaymentStatus[] = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.PAY_LATER,
];
