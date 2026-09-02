import { MovementType, Prisma, ProductType, type InventoryMovement } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { LOCATION_CODES } from "@/lib/domain/locations";
import {
  assertAllowedV1Transfer,
  assertPositiveQuantity,
  assertReceiptDestination,
  convertPackToBase,
  nextStockAfterAdjustment,
  nextStockAfterCount,
  nextStockAfterIncrease,
  nextStockAfterTransferOut,
  nextStockAfterWaste,
} from "@/lib/domain/stock";
import { costTimesQuantity, toDecimal, unitCostFromTotalPrice } from "@/lib/domain/money";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { lockProductStockForUpdate, lockProductStocksForUpdate } from "@/lib/stock-lock";
import {
  applyStockChange,
  ensureTrackedProductStocks,
  requireInventoryManager,
  requireMainLocation,
  rethrowDomain,
  syncCompatibilityStock,
} from "@/services/stock";

type Tx = Prisma.TransactionClient;

/** Per-request key for waste/count/adjust retries. Uniqueness is enforced by InventoryMovement.idempotencyKey. */
function requireMutationKey(key: string, kind: "waste" | "count" | "adjustment") {
  if (!key.trim()) throw new AppError(`Missing ${kind} key. Please try again.`);
}

async function replayMovementByKey(db: Tx | typeof prisma, idempotencyKey: string) {
  return db.inventoryMovement.findUnique({ where: { idempotencyKey } });
}

function uniqueConstraintFields(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  if (typeof target === "string") return [target];
  if (Array.isArray(target)) return target.map((field) => String(field));
  return [];
}

function isMovementIdempotencyConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const fields = uniqueConstraintFields(error);
  if (fields.length === 0) return true;
  return fields.some((field) => field.includes("idempotencyKey"));
}

/** Replay only the InventoryMovement.idempotencyKey unique conflict, outside the aborted transaction. */
async function withUniqueMovementReplay(
  idempotencyKey: string,
  run: () => Promise<InventoryMovement>,
): Promise<InventoryMovement> {
  try {
    return await run();
  } catch (error) {
    if (isMovementIdempotencyConflict(error)) {
      const replayed = await replayMovementByKey(prisma, idempotencyKey);
      if (replayed) return replayed;
    }
    throw error;
  }
}

async function requireTrackedProduct(tx: Tx | typeof prisma, productId: string) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { defaultStockLocation: true, baseUnit: true },
  });
  if (!product) throw new AppError("Product not found.");
  if (!product.trackInventory) {
    throw new AppError("This product does not track inventory.");
  }
  return product;
}

export async function receiveStock(input: {
  supplierId: string;
  locationId?: string;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
  userId: string;
  lines: {
    productId: string;
    packUnitId?: string;
    packQuantity: number;
    packCost?: number;
    unitCost?: number;
  }[];
}) {
  if (!input.idempotencyKey.trim()) throw new AppError("Missing receipt key. Please try again.");
  if (input.lines.length === 0) throw new AppError("Add at least one product.");

  const existing = await prisma.stockReceipt.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { lines: true, location: true, supplier: true },
  });
  if (existing) return existing;

  try {
    return await prisma.$transaction(async (tx) => {
      await requireInventoryManager(tx, input.userId);

      const replay = await tx.stockReceipt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true, location: true, supplier: true },
      });
      if (replay) return replay;

      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier) throw new AppError("Supplier not found.");
      if (!supplier.active) throw new AppError("This supplier is not active.");

      const main = await requireMainLocation(tx);
      if (input.locationId && input.locationId !== main.id) {
        const requested = await tx.stockLocation.findUnique({ where: { id: input.locationId } });
        try {
          assertReceiptDestination(requested?.code ?? "UNKNOWN");
        } catch (error) {
          rethrowDomain(error);
        }
      }

      const lines = [];
      for (const line of input.lines) {
        const product = await requireTrackedProduct(tx, line.productId);
        await ensureTrackedProductStocks(tx, product.id);
        try {
          assertPositiveQuantity(line.packQuantity, "Quantity");
        } catch (error) {
          rethrowDomain(error);
        }
        let baseQuantity = line.packQuantity;
        if (line.packUnitId) {
          const pack = await tx.productPack.findUnique({
            where: { productId_unitId: { productId: product.id, unitId: line.packUnitId } },
            include: { unit: true },
          });
          if (!pack || !pack.active) {
            const unit = await tx.unit.findUnique({ where: { id: line.packUnitId } });
            const purchaseName = unit?.name ?? "that unit";
            const countedAs = product.baseUnit?.name ?? "stock units";
            throw new AppError(
              `${product.name} does not have a conversion for ${purchaseName} yet. Set how many ${countedAs.toLowerCase()} are in 1 ${purchaseName.toLowerCase()} under Products → ${product.name}.`,
            );
          }
          try {
            baseQuantity = convertPackToBase(line.packQuantity, pack.baseQuantity);
          } catch (error) {
            rethrowDomain(error);
          }
        }
        let unitCost: Prisma.Decimal | null = null;
        if (line.packCost != null) {
          try {
            unitCost = unitCostFromTotalPrice(line.packCost, baseQuantity);
          } catch (error) {
            rethrowDomain(error);
          }
        } else if (line.unitCost != null) {
          if (!Number.isFinite(line.unitCost) || line.unitCost <= 0) {
            throw new AppError("Price paid must be greater than 0.");
          }
          unitCost = toDecimal(line.unitCost);
        }
        lines.push({
          product,
          packUnitId: line.packUnitId,
          packQuantity: line.packQuantity,
          baseQuantity,
          unitCost,
        });
      }

      await lockProductStocksForUpdate(
        tx,
        lines.map((line) => ({ productId: line.product.id, locationId: main.id })),
      );

      const receipt = await tx.stockReceipt.create({
        data: {
          supplierId: supplier.id,
          locationId: main.id,
          reference: input.reference?.trim() || null,
          receivedById: input.userId,
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: lines.map((line) => ({
              productId: line.product.id,
              packUnitId: line.packUnitId ?? null,
              packQuantity: line.packQuantity,
              baseQuantity: line.baseQuantity,
              unitCost: line.unitCost ?? null,
            })),
          },
        },
        include: { lines: true, location: true, supplier: true },
      });

      for (const created of receipt.lines) {
        const stock = await tx.productStock.findUnique({
          where: { productId_locationId: { productId: created.productId, locationId: main.id } },
        });
        if (!stock) throw new AppError("Main stock record is missing.");
        let next: number;
        try {
          next = nextStockAfterIncrease(stock.quantity, created.baseQuantity);
        } catch (error) {
          rethrowDomain(error);
        }
        await applyStockChange(tx, {
          productId: created.productId,
          locationId: main.id,
          next,
          delta: created.baseQuantity,
          type: MovementType.PURCHASE,
          userId: input.userId,
          reason: input.notes?.trim() || "Purchase received",
          reference: receipt.id,
          receiptId: receipt.id,
          receiptLineId: created.id,
        });
        if (created.unitCost != null) {
          await tx.product.update({
            where: { id: created.productId },
            data: { costPrice: created.unitCost },
          });
        }
      }

      await writeAudit({
        tx,
        userId: input.userId,
        action: "STOCK_RECEIVED",
        entity: "StockReceipt",
        entityId: receipt.id,
        after: {
          supplier: supplier.name,
          location: main.code,
          lines: receipt.lines.map((line) => ({
            productId: line.productId,
            baseQuantity: line.baseQuantity,
          })),
        },
      });
      return receipt;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replayed = await prisma.stockReceipt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true, location: true, supplier: true },
      });
      if (replayed) return replayed;
    }
    throw error;
  }
}

export async function transferStock(input: {
  fromLocationId?: string;
  toLocationId: string;
  notes?: string;
  idempotencyKey: string;
  userId: string;
  lines: { productId: string; baseQuantity: number }[];
}) {
  if (!input.idempotencyKey.trim()) throw new AppError("Missing transfer key. Please try again.");
  if (input.lines.length === 0) throw new AppError("Add at least one product.");

  const existing = await prisma.stockTransfer.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { lines: true, fromLocation: true, toLocation: true },
  });
  if (existing) return existing;

  try {
    return await prisma.$transaction(async (tx) => {
      await requireInventoryManager(tx, input.userId);

      const replay = await tx.stockTransfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true, fromLocation: true, toLocation: true },
      });
      if (replay) return replay;

      const from = await requireMainLocation(tx);
      if (input.fromLocationId && input.fromLocationId !== from.id) {
        throw new AppError("Stock can only be transferred from Main Stock.");
      }
      const to = await tx.stockLocation.findUnique({ where: { id: input.toLocationId } });
      if (!to || !to.active) throw new AppError("Please choose where to move the stock.");
      try {
        assertAllowedV1Transfer(from.code, to.code);
      } catch (error) {
        rethrowDomain(error);
      }

      const lines = [];
      for (const line of input.lines) {
        const product = await requireTrackedProduct(tx, line.productId);
        await ensureTrackedProductStocks(tx, product.id);
        try {
          assertPositiveQuantity(line.baseQuantity, "Transfer quantity");
        } catch (error) {
          rethrowDomain(error);
        }
        lines.push({ product, baseQuantity: line.baseQuantity });
      }

      await lockProductStocksForUpdate(tx, [
        ...lines.map((line) => ({ productId: line.product.id, locationId: from.id })),
        ...lines.map((line) => ({ productId: line.product.id, locationId: to.id })),
      ]);

      const transfer = await tx.stockTransfer.create({
        data: {
          fromLocationId: from.id,
          toLocationId: to.id,
          userId: input.userId,
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: lines.map((line) => ({
              productId: line.product.id,
              baseQuantity: line.baseQuantity,
            })),
          },
        },
        include: { lines: true, fromLocation: true, toLocation: true },
      });

      for (const line of transfer.lines) {
        const source = await tx.productStock.findUnique({
          where: { productId_locationId: { productId: line.productId, locationId: from.id } },
        });
        const dest = await tx.productStock.findUnique({
          where: { productId_locationId: { productId: line.productId, locationId: to.id } },
        });
        if (!source || !dest) throw new AppError("Stock record not found.");
        let nextSource: number;
        let nextDest: number;
        try {
          nextSource = nextStockAfterTransferOut(source.quantity, line.baseQuantity);
          nextDest = nextStockAfterIncrease(dest.quantity, line.baseQuantity);
        } catch (error) {
          const product = lines.find((entry) => entry.product.id === line.productId)?.product;
          if (error instanceof Error && /enough stock to transfer/.test(error.message)) {
            throw new AppError(
              `Not enough ${product?.name ?? "stock"} in Main Stock. Available: ${source.quantity}.`,
            );
          }
          rethrowDomain(error);
        }
        await applyStockChange(tx, {
          productId: line.productId,
          locationId: from.id,
          next: nextSource,
          delta: -line.baseQuantity,
          type: MovementType.TRANSFER_OUT,
          userId: input.userId,
          reason: input.notes?.trim() || "Stock transfer",
          reference: transfer.id,
          transferId: transfer.id,
        });
        await applyStockChange(tx, {
          productId: line.productId,
          locationId: to.id,
          next: nextDest,
          delta: line.baseQuantity,
          type: MovementType.TRANSFER_IN,
          userId: input.userId,
          reason: input.notes?.trim() || "Stock transfer",
          reference: transfer.id,
          transferId: transfer.id,
        });
      }

      await writeAudit({
        tx,
        userId: input.userId,
        action: "STOCK_TRANSFERRED",
        entity: "StockTransfer",
        entityId: transfer.id,
        after: { from: from.code, to: to.code, lines: transfer.lines },
      });
      return transfer;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replayed = await prisma.stockTransfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true, fromLocation: true, toLocation: true },
      });
      if (replayed) return replayed;
    }
    throw error;
  }
}

export async function recordWaste(input: {
  productId: string;
  locationId: string;
  quantity: number;
  reason: string;
  userId: string;
  idempotencyKey: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 2) throw new AppError("Give a short reason for waste.");
  requireMutationKey(input.idempotencyKey, "waste");

  return withUniqueMovementReplay(input.idempotencyKey, () =>
    prisma.$transaction(async (tx) => {
      await requireInventoryManager(tx, input.userId);
      const replay = await replayMovementByKey(tx, input.idempotencyKey);
      if (replay) return replay;

      const product = await requireTrackedProduct(tx, input.productId);
      await ensureTrackedProductStocks(tx, product.id);
      const location = await tx.stockLocation.findUnique({ where: { id: input.locationId } });
      if (!location || !location.active) throw new AppError("Please choose where the stock is located.");
      await lockProductStockForUpdate(tx, product.id, location.id);
      const lockedReplay = await replayMovementByKey(tx, input.idempotencyKey);
      if (lockedReplay) return lockedReplay;
      const stock = await tx.productStock.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: location.id } },
      });
      if (!stock) throw new AppError("Stock record not found.");
      let next: number;
      try {
        next = nextStockAfterWaste(stock.quantity, input.quantity);
      } catch (error) {
        if (error instanceof Error && /cannot exceed/.test(error.message)) {
          throw new AppError(
            `Not enough ${product.name} in ${location.name}. Available: ${stock.quantity}.`,
          );
        }
        rethrowDomain(error);
      }
      const movement = await applyStockChange(tx, {
        productId: product.id,
        locationId: location.id,
        next,
        delta: -input.quantity,
        type: MovementType.WASTE,
        userId: input.userId,
        reason,
        idempotencyKey: input.idempotencyKey,
      });
      await writeAudit({
        tx,
        userId: input.userId,
        action: "STOCK_WASTE",
        entity: "InventoryMovement",
        entityId: movement.id,
        before: { quantity: stock.quantity, location: location.code },
        after: { quantity: next, reason },
      });
      return movement;
    }),
  );
}

export async function adjustStock(input: {
  productId: string;
  locationId: string;
  delta: number;
  reason: string;
  userId: string;
  idempotencyKey: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 2) throw new AppError("Give a short reason for the adjustment.");
  requireMutationKey(input.idempotencyKey, "adjustment");

  return withUniqueMovementReplay(input.idempotencyKey, () =>
    prisma.$transaction(async (tx) => {
      await requireInventoryManager(tx, input.userId);
      const replay = await replayMovementByKey(tx, input.idempotencyKey);
      if (replay) return replay;

      const product = await requireTrackedProduct(tx, input.productId);
      await ensureTrackedProductStocks(tx, product.id);
      const location = await tx.stockLocation.findUnique({ where: { id: input.locationId } });
      if (!location || !location.active) throw new AppError("Please choose where the stock is located.");
      await lockProductStockForUpdate(tx, product.id, location.id);
      const lockedReplay = await replayMovementByKey(tx, input.idempotencyKey);
      if (lockedReplay) return lockedReplay;
      const stock = await tx.productStock.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: location.id } },
      });
      if (!stock) throw new AppError("Stock record not found.");
      let next: number;
      try {
        next = nextStockAfterAdjustment(stock.quantity, input.delta);
      } catch (error) {
        if (error instanceof Error && /negative/.test(error.message)) {
          throw new AppError(
            `That change would take ${product.name} below zero in ${location.name}. Available: ${stock.quantity}.`,
          );
        }
        rethrowDomain(error);
      }
      const movement = await applyStockChange(tx, {
        productId: product.id,
        locationId: location.id,
        next,
        delta: input.delta,
        type: MovementType.ADJUSTMENT,
        userId: input.userId,
        reason,
        idempotencyKey: input.idempotencyKey,
      });
      await writeAudit({
        tx,
        userId: input.userId,
        action: "STOCK_ADJUSTED",
        entity: "InventoryMovement",
        entityId: movement.id,
        before: { quantity: stock.quantity, location: location.code },
        after: { quantity: next, delta: input.delta, reason },
      });
      return movement;
    }),
  );
}

export async function countStock(input: {
  productId: string;
  locationId: string;
  counted: number;
  userId: string;
  idempotencyKey: string;
}) {
  requireMutationKey(input.idempotencyKey, "count");

  return withUniqueMovementReplay(input.idempotencyKey, () =>
    prisma.$transaction(async (tx) => {
      await requireInventoryManager(tx, input.userId);
      const replay = await replayMovementByKey(tx, input.idempotencyKey);
      if (replay) return replay;

      const product = await requireTrackedProduct(tx, input.productId);
      await ensureTrackedProductStocks(tx, product.id);
      const location = await tx.stockLocation.findUnique({ where: { id: input.locationId } });
      if (!location || !location.active) throw new AppError("Please choose where the stock is located.");
      await lockProductStockForUpdate(tx, product.id, location.id);
      const lockedReplay = await replayMovementByKey(tx, input.idempotencyKey);
      if (lockedReplay) return lockedReplay;
      const stock = await tx.productStock.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: location.id } },
      });
      if (!stock) throw new AppError("Stock record not found.");
      let next: number;
      try {
        next = nextStockAfterCount(input.counted).next;
      } catch (error) {
        if (error instanceof Error && /negative/.test(error.message)) {
          throw new AppError("The counted quantity cannot be below zero.");
        }
        rethrowDomain(error);
      }
      const delta = next - stock.quantity;
      const movement = await applyStockChange(tx, {
        productId: product.id,
        locationId: location.id,
        next,
        delta,
        type: MovementType.COUNT,
        userId: input.userId,
        reason: "Stock count",
        idempotencyKey: input.idempotencyKey,
      });
      await writeAudit({
        tx,
        userId: input.userId,
        action: "STOCK_COUNTED",
        entity: "InventoryMovement",
        entityId: movement.id,
        before: { quantity: stock.quantity, location: location.code },
        after: { counted: next, delta },
      });
      return movement;
    }),
  );
}

export async function upsertProductPack(input: {
  productId: string;
  unitId: string;
  baseQuantity: number;
  userId: string;
  active?: boolean;
}) {
  await requireInventoryManager(prisma, input.userId);
  try {
    assertPositiveQuantity(input.baseQuantity, "Pack base quantity");
  } catch (error) {
    rethrowDomain(error);
  }
  const product = await requireTrackedProduct(prisma, input.productId);
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit || !unit.active) throw new AppError("Choose a valid unit.");
  return prisma.productPack.upsert({
    where: { productId_unitId: { productId: product.id, unitId: unit.id } },
    update: { baseQuantity: input.baseQuantity, active: input.active ?? true },
    create: {
      productId: product.id,
      unitId: unit.id,
      baseQuantity: input.baseQuantity,
      active: input.active ?? true,
    },
  });
}

export async function listStock(lowOnly = false) {
  const rows = await prisma.product.findMany({
    where: { trackInventory: true, active: true },
    select: {
      id: true,
      name: true,
      productType: true,
      stockQuantity: true,
      costPrice: true,
      category: { select: { id: true, name: true } },
      baseUnit: { select: { id: true, code: true, name: true } },
      packs: {
        where: { active: true },
        select: {
          unitId: true,
          baseQuantity: true,
          unit: { select: { id: true, code: true, name: true } },
        },
      },
      stocks: {
        select: {
          quantity: true,
          location: { select: { id: true, code: true, name: true, sortOrder: true } },
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
  return rows
    .map((product) => {
      const byCode = Object.fromEntries(product.stocks.map((row) => [row.location.code, row.quantity]));
      const main = byCode[LOCATION_CODES.MAIN] ?? 0;
      const bar = byCode[LOCATION_CODES.BAR] ?? 0;
      const kitchen = byCode[LOCATION_CODES.KITCHEN] ?? 0;
      const cafe = byCode[LOCATION_CODES.CAFE] ?? 0;
      const total = main + bar + kitchen + cafe;
      return {
        ...product,
        main,
        bar,
        kitchen,
        cafe,
        total,
        costPrice: product.costPrice == null ? null : Number(product.costPrice.toString()),
        valuation: Number(costTimesQuantity(product.costPrice, total).toString()),
      };
    })
    .filter((product) => (lowOnly ? product.total <= 5 : true));
}

export async function listMovements(take = 80, filter?: { type?: MovementType; locationId?: string }) {
  return prisma.inventoryMovement.findMany({
    where: {
      type: filter?.type,
      locationId: filter?.locationId,
    },
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      location: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listReceipts(take = 80) {
  return prisma.stockReceipt.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
      location: { select: { code: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { receivedAt: "desc" },
    take,
  });
}

export async function listTransfers(take = 80) {
  return prisma.stockTransfer.findMany({
    include: {
      fromLocation: { select: { code: true, name: true } },
      toLocation: { select: { code: true, name: true } },
      user: { select: { id: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listLocations() {
  return prisma.stockLocation.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function listUnits() {
  return prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } });
}

export async function listInventoryMaterials() {
  return prisma.product.findMany({
    where: { productType: ProductType.RAW_MATERIAL },
    include: {
      category: true,
      stocks: { include: { location: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function inventoryValuation() {
  const stock = await listStock();
  const byLocation = {
    MAIN: stock.reduce((sum, row) => sum + Number(costTimesQuantity(row.costPrice, row.main).toString()), 0),
    BAR: stock.reduce((sum, row) => sum + Number(costTimesQuantity(row.costPrice, row.bar).toString()), 0),
    KITCHEN: stock.reduce((sum, row) => sum + Number(costTimesQuantity(row.costPrice, row.kitchen).toString()), 0),
    CAFE: stock.reduce((sum, row) => sum + Number(costTimesQuantity(row.costPrice, row.cafe).toString()), 0),
  };
  return {
    byLocation,
    total: byLocation.MAIN + byLocation.BAR + byLocation.KITCHEN + byLocation.CAFE,
    method: "last-cost" as const,
  };
}

export { getLocationByCode, requireOperationalLocation, syncCompatibilityStock } from "@/services/stock";
