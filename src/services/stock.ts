import { LocationKind, MovementType, Prisma, PrismaClient, ProductType } from "@prisma/client";
import { hasPermission } from "@/lib/auth/roles";
import { LOCATION_CODES, WAREHOUSE_CODE } from "@/lib/domain/locations";
import { AppError } from "@/lib/errors";

export type Db = Prisma.TransactionClient | PrismaClient;

export function rethrowDomain(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Error) throw new AppError(error.message);
  throw error;
}

export async function requireInventoryManager(tx: Db, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) throw new AppError("User not found.");
  if (!hasPermission(user.role, "manageInventory")) {
    throw new AppError("You are not allowed to manage inventory.");
  }
  return user;
}

export async function getLocationByCode(tx: Db, code: string) {
  const location = await tx.stockLocation.findUnique({ where: { code } });
  if (!location) throw new AppError(`Stock location ${code} is not configured.`);
  if (!location.active) throw new AppError(`${location.name} is not active.`);
  return location;
}

export async function requireMainLocation(tx: Db) {
  const location = await getLocationByCode(tx, WAREHOUSE_CODE);
  if (location.kind !== LocationKind.WAREHOUSE) {
    throw new AppError("Main Stock is not configured as a warehouse.");
  }
  return location;
}

export async function requireOperationalLocation(tx: Db, locationId: string) {
  const location = await tx.stockLocation.findUnique({ where: { id: locationId } });
  if (!location || !location.active) throw new AppError("Choose a valid stock location.");
  if (location.kind !== LocationKind.OPERATIONAL || location.code === LOCATION_CODES.MAIN) {
    throw new AppError("This operation cannot use Main Stock.");
  }
  return location;
}

export async function ensureTrackedProductStocks(tx: Db, productId: string, mainQuantity?: number) {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { stockQuantity: true } });
  if (!product) throw new AppError("Product not found.");
  const existing = await tx.productStock.findMany({ where: { productId }, select: { id: true } });
  const initialMain = mainQuantity ?? (existing.length === 0 ? product.stockQuantity : 0);
  const locations = await tx.stockLocation.findMany({ orderBy: { sortOrder: "asc" } });
  for (const location of locations) {
    const row = await tx.productStock.findUnique({
      where: { productId_locationId: { productId, locationId: location.id } },
    });
    if (row) continue;
    await tx.productStock.create({
      data: {
        productId,
        locationId: location.id,
        quantity: location.code === LOCATION_CODES.MAIN ? initialMain : 0,
      },
    });
  }
}

export async function syncCompatibilityStock(tx: Db, productId: string) {
  const rows = await tx.productStock.findMany({ where: { productId }, select: { quantity: true } });
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  await tx.product.update({ where: { id: productId }, data: { stockQuantity: total } });
  return total;
}

export function sellOnPosForType(productType: ProductType) {
  return productType !== ProductType.RAW_MATERIAL;
}

export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    locationId: string;
    next: number;
    delta: number;
    type: MovementType;
    userId: string;
    reason?: string;
    reference?: string;
    transferId?: string;
    receiptId?: string;
    receiptLineId?: string;
    orderId?: string;
    orderItemId?: string;
  },
) {
  await tx.productStock.update({
    where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    data: { quantity: input.next },
  });
  const movement = await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      locationId: input.locationId,
      quantity: input.delta,
      type: input.type,
      reason: input.reason,
      userId: input.userId,
      reference: input.reference,
      transferId: input.transferId,
      receiptId: input.receiptId,
      receiptLineId: input.receiptLineId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
    },
  });
  await syncCompatibilityStock(tx, input.productId);
  return movement;
}
