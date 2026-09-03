import { PaymentStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { hasPermission, isRole } from "@/lib/auth/roles";
import { paymentStatusAfterAmount } from "@/lib/domain/payments";
import { AppError } from "@/lib/errors";
import { lockMaisonRecordForUpdate } from "@/lib/maison-lock";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

async function requireMaisonManager(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || !user.active || user.deletedAt) throw new AppError("User not found.");
  if (!isRole(user.role) || !hasPermission(user.role, "manageMaison")) {
    throw new AppError("You are not allowed to manage Maison.");
  }
  return user;
}

function requirePaymentKey(key: string) {
  if (!key.trim()) throw new AppError("Missing payment key. Please try again.");
}

function uniqueConstraintFields(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  if (typeof target === "string") return [target];
  if (Array.isArray(target)) return target.map((field) => String(field));
  return [];
}

function isMaisonPaymentKeyConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const fields = uniqueConstraintFields(error);
  if (fields.length === 0) return true;
  return fields.some((field) => field.includes("idempotencyKey"));
}

async function maisonRecordForPayment(db: Tx | typeof prisma, idempotencyKey: string) {
  const payment = await db.maisonPayment.findUnique({
    where: { idempotencyKey },
    include: { maisonRecord: true },
  });
  return payment?.maisonRecord ?? null;
}

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
  idempotencyKey: string;
}) {
  requirePaymentKey(input.idempotencyKey);

  try {
    return await prisma.$transaction(async (tx) => {
      await requireMaisonManager(tx, input.staffId);

      const replay = await maisonRecordForPayment(tx, input.idempotencyKey);
      if (replay) return replay;

      await lockMaisonRecordForUpdate(tx, input.id);
      const lockedReplay = await maisonRecordForPayment(tx, input.idempotencyKey);
      if (lockedReplay) return lockedReplay;

      const record = await tx.maisonRecord.findUnique({ where: { id: input.id } });
      if (!record) throw new AppError("Maison record not found.");
      if (!Number.isInteger(input.amount) || input.amount <= 0) {
        throw new AppError("Payment amount must be a positive whole number.");
      }
      const remaining = record.amount - record.paidAmount;
      if (remaining <= 0) {
        throw new AppError("This bill is already paid.");
      }
      if (input.amount > remaining) {
        throw new AppError("Payment is larger than the remaining balance.");
      }

      const nextPaid = record.paidAmount + input.amount;
      const nextStatus = paymentStatusAfterAmount(record.amount, nextPaid);

      const payment = await tx.maisonPayment.create({
        data: {
          maisonRecordId: record.id,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const updated = await tx.maisonRecord.update({
        where: { id: record.id },
        data: {
          paidAmount: nextPaid,
          paymentStatus: nextStatus,
        },
      });

      await writeAudit({
        tx,
        userId: input.staffId,
        action: "MAISON_PAYMENT",
        entity: "MaisonPayment",
        entityId: payment.id,
        before: { paidAmount: record.paidAmount, paymentStatus: record.paymentStatus },
        after: {
          amount: input.amount,
          paidAmount: nextPaid,
          paymentStatus: nextStatus,
          maisonRecordId: record.id,
        },
      });

      return updated;
    });
  } catch (error) {
    if (isMaisonPaymentKeyConflict(error)) {
      const replayed = await maisonRecordForPayment(prisma, input.idempotencyKey);
      if (replayed) return replayed;
    }
    throw error;
  }
}

export function maisonBalance(amount: number, paidAmount: number) {
  return Math.max(0, amount - paidAmount);
}

export const maisonOpenStatuses: PaymentStatus[] = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.PAY_LATER,
];
