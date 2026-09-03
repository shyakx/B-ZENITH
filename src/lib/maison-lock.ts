import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

/**
 * Serialize Maison payments on the same stay row.
 * Call this before reading paidAmount or deciding whether a payment fits.
 */
export async function lockMaisonRecordForUpdate(tx: Tx, maisonRecordId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "MaisonRecord" WHERE id = ${maisonRecordId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new AppError("Maison record not found.");
  }
}
