import { BusinessArea, Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureTrackedProductStocks, getLocationByCode, syncCompatibilityStock } from "@/services/stock";

export async function stockAt(productId: string, code: string) {
  const location = await getLocationByCode(prisma, code);
  const row = await prisma.productStock.findUnique({
    where: { productId_locationId: { productId, locationId: location.id } },
  });
  return row?.quantity ?? 0;
}

export async function setStock(productId: string, code: string, quantity: number) {
  await ensureTrackedProductStocks(prisma, productId);
  const location = await getLocationByCode(prisma, code);
  await prisma.productStock.update({
    where: { productId_locationId: { productId, locationId: location.id } },
    data: { quantity },
  });
  await syncCompatibilityStock(prisma, productId);
}

export async function snapshotProductStock(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  const stocks = await prisma.productStock.findMany({ where: { productId } });
  return { productId, stockQuantity: product?.stockQuantity ?? 0, stocks };
}

export async function restoreProductStock(snapshot: Awaited<ReturnType<typeof snapshotProductStock>>) {
  for (const row of snapshot.stocks) {
    await prisma.productStock.update({
      where: { id: row.id },
      data: { quantity: row.quantity },
    });
  }
  await prisma.product.update({
    where: { id: snapshot.productId },
    data: { stockQuantity: snapshot.stockQuantity },
  });
}

export async function preparePosStock(productId: string) {
  await ensureTrackedProductStocks(prisma, productId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { defaultStockLocation: true },
  });
  if (!product) throw new Error("Product not found.");
  const location = product.defaultStockLocation;
  if (!location) throw new Error("Product has no default stock location.");
  const current = await stockAt(productId, location.code);
  if (current > 0) return current;
  const main = await stockAt(productId, "MAIN");
  const qty = Math.max(main, product.stockQuantity);
  if (qty > 0) {
    await setStock(productId, "MAIN", 0);
    await setStock(productId, location.code, qty);
  }
  return qty;
}

export async function cleanupInventoryArtifacts(productIds: string[]) {
  if (productIds.length === 0) return;
  const transfers = await prisma.stockTransfer.findMany({
    where: { lines: { some: { productId: { in: productIds } } } },
    select: { id: true },
  });
  const receipts = await prisma.stockReceipt.findMany({
    where: { lines: { some: { productId: { in: productIds } } } },
    select: { id: true },
  });
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        ...(transfers.length > 0 ? [{ transferId: { in: transfers.map((row) => row.id) } }] : []),
        ...(receipts.length > 0 ? [{ receiptId: { in: receipts.map((row) => row.id) } }] : []),
      ],
    },
  });
  await prisma.stockTransferLine.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockReceiptLine.deleteMany({ where: { productId: { in: productIds } } });
  if (transfers.length > 0) {
    await prisma.stockTransfer.deleteMany({ where: { id: { in: transfers.map((row) => row.id) } } });
  }
  if (receipts.length > 0) {
    await prisma.stockReceipt.deleteMany({ where: { id: { in: receipts.map((row) => row.id) } } });
  }
  await prisma.productPack.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productStock.deleteMany({ where: { productId: { in: productIds } } });
}

export async function createIsolatedPosProduct(input: {
  sellingPrice?: number;
  barQuantity?: number;
}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bar = await getLocationByCode(prisma, "BAR");
  const bottle = await prisma.unit.findUnique({ where: { code: "BOTTLE" } });
  const category = await prisma.category.create({
    data: { name: `POS Test ${stamp}`, area: BusinessArea.BAR },
  });
  const product = await prisma.product.create({
    data: {
      name: `POS Lager ${stamp}`,
      categoryId: category.id,
      sellingPrice: input.sellingPrice ?? 2000,
      trackInventory: true,
      stockQuantity: 0,
      productType: ProductType.PACKAGED_GOOD,
      sellOnPos: true,
      defaultStockLocationId: bar.id,
      baseUnitId: bottle?.id,
      active: true,
    },
  });
  await ensureTrackedProductStocks(prisma, product.id, 0);
  await setStock(product.id, "BAR", input.barQuantity ?? 50);
  return { product, category, barQuantity: input.barQuantity ?? 50 };
}

export { Prisma, ProductType };
