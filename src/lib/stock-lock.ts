import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

export async function lockProductForUpdate(tx: Tx, productId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new AppError("Product not found.");
  }
}

export async function lockProductsForUpdate(tx: Tx, productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
  `;
}
