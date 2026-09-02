import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Serialize payment and cancellation on the same Order row.
 * Call this before reading paidAmount, paymentStatus, or deciding to restore stock.
 */
export async function lockOrderForUpdate(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}
