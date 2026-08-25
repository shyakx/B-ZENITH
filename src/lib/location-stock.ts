import type { InventoryMovementType, Prisma } from "@prisma/client";

export const LOCATION_CODES = {
  MAIN_STOCK: "MAIN_STOCK",
  BAR: "BAR",
  KITCHEN: "KITCHEN",
} as const;

export type LocationCode = (typeof LOCATION_CODES)[keyof typeof LOCATION_CODES];
export const ALLOWED_TRANSFER_FROM = LOCATION_CODES.MAIN_STOCK;
export const ALLOWED_TRANSFER_TO = [LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN] as const;
export class StockError extends Error {}

export function requireSellingLocationId(sellingLocationId: string | null | undefined) {
  if (!sellingLocationId) {
    throw new StockError("This tracked product has no selling location. Set Bar or Kitchen before selling.");
  }
  return sellingLocationId;
}

export function saleVoidClaimed(updatedCount: number) {
  return updatedCount === 1;
}

export function restoreLocationId(inventoryLocationId: string | null | undefined, mainStockId: string) {
  return inventoryLocationId || mainStockId;
}

export function openingMainQuantity(
  existingMainQty: number | null,
  totalLocationQty: number,
  productStockQuantity: number,
) {
  if (existingMainQty === null) return Math.max(0, productStockQuantity);
  if (totalLocationQty === 0 && productStockQuantity > 0) return productStockQuantity;
  return existingMainQty;
}

type Tx = Prisma.TransactionClient;
export type TransferLineInput = { productId: string; quantity: number };

export function validateTransferRequest(fromCode: string, toCode: string, lines: TransferLineInput[]) {
  if (fromCode !== ALLOWED_TRANSFER_FROM) {
    return { ok: false as const, error: "Stock can only leave Main Stock in this phase." };
  }
  if (!ALLOWED_TRANSFER_TO.includes(toCode as (typeof ALLOWED_TRANSFER_TO)[number])) {
    return { ok: false as const, error: "Stock can only be sent to Bar or Kitchen in this phase." };
  }
  if (fromCode === toCode) return { ok: false as const, error: "Source and destination must be different." };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one product." };
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.productId) return { ok: false as const, error: "Choose a product." };
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false as const, error: "Quantities must be whole numbers greater than zero." };
    }
    if (seen.has(line.productId)) {
      return { ok: false as const, error: "Each product can appear only once on a transfer." };
    }
    seen.add(line.productId);
  }
  return { ok: true as const };
}

export async function getLocationByCode(tx: Tx, code: string) {
  const location = await tx.inventoryLocation.findUnique({ where: { code } });
  if (!location || !location.active) throw new StockError(`Inventory location ${code} is not available.`);
  return location;
}

export async function locationQuantity(tx: Tx, productId: string, locationId: string) {
  const row = await tx.productLocationStock.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });
  return row?.quantity ?? 0;
}

/**
 * Updates the cached Product.stockQuantity total.
 * THIS IS THE ONLY PLACE stockQuantity SHOULD BE UPDATED.
 */
async function syncProductTotal(tx: Tx, productId: string) {
  const aggregate = await tx.productLocationStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const total = aggregate._sum.quantity ?? 0;
  await tx.product.update({
    where: { id: productId },
    data: { stockQuantity: total },
  });
  return total;
}

async function ensureRow(tx: Tx, productId: string, locationId: string) {
  await tx.productLocationStock.upsert({
    where: { productId_locationId: { productId, locationId } },
    create: { productId, locationId, quantity: 0 },
    update: {},
  });
}

/**
 * EXPLICITLY THE ONLY AUTHORITATIVE WAY TO MUTATE STOCK.
 * Updates location-specific stock, creates a movement record,
 * and synchronizes the cached product total.
 */
export async function applyLocationDelta(
  tx: Tx,
  input: {
    productId: string;
    locationId: string;
    delta: number;
    type: InventoryMovementType;
    performedById: string;
    referenceId?: string;
    note?: string;
    reason?: string;
    counterpartLocationId?: string;
    allowNegative?: boolean;
  },
) {
  await ensureRow(tx, input.productId, input.locationId);

  if (input.delta < 0) {
    const needed = -input.delta;
    if (input.allowNegative) {
      await tx.productLocationStock.update({
        where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
        data: { quantity: { decrement: needed } },
      });
    } else {
      const updated = await tx.productLocationStock.updateMany({
        where: {
          productId: input.productId,
          locationId: input.locationId,
          quantity: { gte: needed },
        },
        data: { quantity: { decrement: needed } },
      });
      if (updated.count !== 1) {
        const product = await tx.product.findUnique({ where: { id: input.productId }, select: { name: true } });
        throw new StockError(`Insufficient stock for ${product?.name ?? "product"} at this location.`);
      }
    }
  } else {
    await tx.productLocationStock.update({
      where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
      data: { quantity: { increment: input.delta } },
    });
  }

  const row = await tx.productLocationStock.findUniqueOrThrow({
    where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
  });

  await syncProductTotal(tx, input.productId);

  await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.delta,
      balanceAfter: row.quantity,
      referenceId: input.referenceId,
      reason: input.reason,
      note: input.note,
      performedById: input.performedById,
      locationId: input.locationId,
      counterpartLocationId: input.counterpartLocationId,
    },
  });

  return row.quantity;
}

export async function setLocationQuantity(
  tx: Tx,
  input: {
    productId: string;
    locationId: string;
    quantity: number;
    type: InventoryMovementType;
    performedById: string;
    referenceId?: string;
    note?: string;
    reason?: string;
  },
) {
  if (input.quantity < 0) throw new StockError("Quantity cannot be negative.");
  await ensureRow(tx, input.productId, input.locationId);
  const current = await locationQuantity(tx, input.productId, input.locationId);
  const delta = input.quantity - current;
  if (delta === 0) throw new StockError("Physical count matches system stock. No adjustment needed.");

  await tx.productLocationStock.update({
    where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    data: { quantity: input.quantity },
  });

  await syncProductTotal(tx, input.productId);

  await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: delta,
      balanceAfter: input.quantity,
      referenceId: input.referenceId,
      reason: input.reason,
      note: input.note,
      performedById: input.performedById,
      locationId: input.locationId,
    },
  });

  return { previousQuantity: current, countedQuantity: input.quantity, adjustment: delta };
}

export async function sellingLocationId(tx: Tx, product: { sellingLocationId: string | null }) {
  const locationId = requireSellingLocationId(product.sellingLocationId);
  const location = await tx.inventoryLocation.findUnique({ where: { id: locationId } });
  if (!location?.active) throw new StockError("This product's selling location is missing or inactive.");
  if (location.code === LOCATION_CODES.MAIN_STOCK) {
    throw new StockError("Tracked sales cannot deduct from Main Stock. Set the selling location to Bar or Kitchen.");
  }
  return location.id;
}

export async function recordStockTransfer(
  tx: Tx,
  input: {
    fromCode: string;
    toCode: string;
    lines: TransferLineInput[];
    recordedById: string;
    note?: string | null;
  },
) {
  const valid = validateTransferRequest(input.fromCode, input.toCode, input.lines);
  if (!valid.ok) throw new StockError(valid.error);
  const from = await getLocationByCode(tx, input.fromCode);
  const to = await getLocationByCode(tx, input.toCode);

  for (const line of input.lines) {
    const product = await tx.product.findUnique({ where: { id: line.productId } });
    if (!product?.trackInventory) throw new StockError("Only tracked products can be transferred.");
  }

  const transfer = await tx.stockTransfer.create({
    data: {
      fromLocationId: from.id,
      toLocationId: to.id,
      recordedById: input.recordedById,
      note: input.note || null,
      lines: { create: input.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })) },
    },
  });

  for (const line of input.lines) {
    await applyLocationDelta(tx, {
      productId: line.productId,
      locationId: from.id,
      delta: -line.quantity,
      type: "TRANSFER_OUT",
      performedById: input.recordedById,
      referenceId: transfer.id,
      note: input.note || undefined,
      counterpartLocationId: to.id,
    });
    await applyLocationDelta(tx, {
      productId: line.productId,
      locationId: to.id,
      delta: line.quantity,
      type: "TRANSFER_IN",
      performedById: input.recordedById,
      referenceId: transfer.id,
      note: input.note || undefined,
      counterpartLocationId: from.id,
    });
  }
  return transfer;
}

export async function ensureTrackedProductStock(
  tx: Tx,
  productId: string,
  trackInventory: boolean,
  sellingLocationCode: "BAR" | "KITCHEN" = LOCATION_CODES.BAR,
) {
  if (!trackInventory) return;
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stockQuantity: true },
  });
  const main = await getLocationByCode(tx, LOCATION_CODES.MAIN_STOCK);
  const selling = await getLocationByCode(tx, sellingLocationCode);

  await tx.product.update({ where: { id: productId }, data: { sellingLocationId: selling.id } });

  const existingMain = await tx.productLocationStock.findUnique({
    where: { productId_locationId: { productId, locationId: main.id } },
  });

  const totals = await tx.productLocationStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });

  const mainQty = openingMainQuantity(
    existingMain ? existingMain.quantity : null,
    totals._sum.quantity ?? 0,
    product.stockQuantity,
  );

  if (!existingMain) {
    await tx.productLocationStock.create({ data: { productId, locationId: main.id, quantity: mainQty } });
  } else if (existingMain.quantity !== mainQty) {
    await tx.productLocationStock.update({ where: { id: existingMain.id }, data: { quantity: mainQty } });
  }

  await ensureRow(tx, productId, selling.id);
  await syncProductTotal(tx, productId);
}

export function stockByLocation(
  stocks: Array<{ location: { code: string }; quantity: number }>,
  codes: string[],
) {
  const map = Object.fromEntries(codes.map((code) => [code, 0]));
  for (const row of stocks) {
    if (row.location.code in map) map[row.location.code] = row.quantity;
  }
  return map;
}
