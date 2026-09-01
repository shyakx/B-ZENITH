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

export async function lockProductStockForUpdate(tx: Tx, productId: string, locationId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "ProductStock"
    WHERE "productId" = ${productId} AND "locationId" = ${locationId}
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new AppError("Stock record not found for this product and location.");
  }
  return rows[0].id;
}

export async function lockProductStocksForUpdate(
  tx: Tx,
  rows: { productId: string; locationId: string }[],
) {
  const unique = [...new Map(rows.map((row) => [`${row.locationId}:${row.productId}`, row])).values()].sort(
    (a, b) => a.locationId.localeCompare(b.locationId) || a.productId.localeCompare(b.productId),
  );
  for (const row of unique) {
    await lockProductStockForUpdate(tx, row.productId, row.locationId);
  }
}
