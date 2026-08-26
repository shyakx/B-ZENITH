import {
  Prisma,
  SessionStatus,
  ItemStatus,
  FulfillmentStatus,
  AdjustmentType,
  ItemCondition,
  StaffActionType,
  ServiceChannel,
  PaymentMethod,
  CreditStatus,
} from "@prisma/client";
import { isUniqueConstraint } from "./idempotency";
import { prisma } from "./prisma";
import { applyLocationDelta, sellingLocationId } from "./location-stock";
import { tableCanStartService } from "./table-admin";

type Tx = Prisma.TransactionClient;

async function claimActiveItem(tx: Tx, sessionItemId: string, nextStatus: ItemStatus) {
  const claimed = await tx.sessionItem.updateMany({
    where: { id: sessionItemId, status: ItemStatus.ACTIVE },
    data: { status: nextStatus },
  });
  if (claimed.count !== 1) {
    throw new HospitalityError("This item has already been adjusted.", "CONFLICT");
  }
}

const adjustmentTx = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 };


export class HospitalityError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "HospitalityError";
  }
}

export function assertWaiterOwnsSession(operatorRole: string, operatorId: string, sessionWaiterId: string) {
  if (operatorRole === "WAITER" && operatorId !== sessionWaiterId) {
    throw new HospitalityError("This service belongs to another waiter.", "FORBIDDEN");
  }
}

export async function requireOperableSession(sessionId: string, operator: { id: string; role: string }) {
  const session = await prisma.serviceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, waiterId: true, status: true },
  });
  if (!session) throw new HospitalityError("Session not found.", "NOT_FOUND");
  assertWaiterOwnsSession(operator.role, operator.id, session.waiterId);
  return session;
}

export async function requireOperableSessionItem(sessionItemId: string, operator: { id: string; role: string }) {
  const item = await prisma.sessionItem.findUnique({
    where: { id: sessionItemId },
    select: { id: true, round: { select: { session: { select: { id: true, waiterId: true } } } } },
  });
  if (!item) throw new HospitalityError("Item not found.", "NOT_FOUND");
  assertWaiterOwnsSession(operator.role, operator.id, item.round.session.waiterId);
  return item;
}

/**
 * CORE HOSPITALITY ENGINE
 * Handles all service session, ordering, and fulfillment logic.
 */

/**
 * POST ORDER: The primary inventory event.
 * Atomically creates an OrderRound and SessionItems, while deducting stock.
 */
export async function postOrder(
  sessionId: string,
  postedById: string,
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }>,
  idempotencyKey?: string
) {
  if (items.length === 0) throw new HospitalityError("No items provided.");

  return await prisma.$transaction(async (tx) => {
    // 1. Verify Session
    const session = await tx.serviceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new HospitalityError("Session not found.", "NOT_FOUND");
    if (session.status !== SessionStatus.ACTIVE) {
      throw new HospitalityError(`Cannot post to a ${session.status} session.`, "CONFLICT");
    }

    // 2. Idempotency Check
    if (idempotencyKey) {
      const existing = await tx.orderRound.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }

    const posting = await tx.serviceSession.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE },
      data: { updatedAt: new Date() },
    });
    if (posting.count !== 1) {
      throw new HospitalityError("Cannot post to a session that is not active.", "CONFLICT");
    }

    // 3. Create Order Round
    const round = await tx.orderRound.create({
      data: {
        sessionId,
        postedById,
        idempotencyKey,
      },
    });

    // 4. Process Items and Inventory
    for (const item of items) {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });

      // Resolve location
      const locId = await sellingLocationId(tx, product);

      // Create Session Item
      const sessionItem = await tx.sessionItem.create({
        data: {
          roundId: round.id,
          productId: item.productId,
          productVariantId: item.variantId,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: product.costPrice,
          inventoryLocationId: locId,
          status: ItemStatus.ACTIVE,
          fulfillmentStatus: FulfillmentStatus.POSTED,
        },
      });

      // Deduct Inventory if tracked
      if (product.trackInventory) {
        await applyLocationDelta(tx, {
          productId: item.productId,
          locationId: locId,
          delta: -item.quantity,
          type: "SESSION_POST",
          performedById: postedById,
          referenceId: sessionItem.id,
          reason: `Session ${sessionId} - Round ${round.id}`,
        });
      }
    }

    // 5. Audit History
    await tx.sessionStaffHistory.create({
      data: {
        sessionId,
        staffId: postedById,
        action: StaffActionType.ROUND_POSTED,
        note: `Posted ${items.length} items in round ${round.id}`,
      },
    });

    return round;
  });
}

/**
 * VOID: Pre-fulfillment correction.
 * Restores inventory to the ORIGINAL location snapshot.
 */
export async function approveVoid(
  sessionItemId: string,
  requestedById: string,
  approvedById: string,
  reason: string,
) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.sessionItem.findUnique({
      where: { id: sessionItemId },
      include: { product: true, round: true },
    });
    if (!item) throw new HospitalityError("Item not found.", "NOT_FOUND");

    await claimActiveItem(tx, sessionItemId, ItemStatus.VOIDED);

    if (item.product.trackInventory && item.inventoryLocationId) {
      await applyLocationDelta(tx, {
        productId: item.productId,
        locationId: item.inventoryLocationId,
        delta: item.qty,
        type: "ORDER_VOID",
        performedById: approvedById,
        referenceId: sessionItemId,
        reason: `VOID: ${reason}`,
      });
    }

    await tx.orderAdjustment.create({
      data: {
        sessionId: item.round.sessionId,
        type: AdjustmentType.VOID,
        originalItemId: sessionItemId,
        quantity: item.qty,
        reason,
        requestedById,
        approvedById,
      },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId: item.round.sessionId,
        staffId: requestedById,
        action: StaffActionType.VOID_REQUESTED,
        note: `Void requested for item ${sessionItemId}`,
      },
    });
    await tx.sessionStaffHistory.create({
      data: {
        sessionId: item.round.sessionId,
        staffId: approvedById,
        action: StaffActionType.VOID_APPROVED,
        note: `Voided item ${sessionItemId}`,
      },
    });
  }, adjustmentTx);
}

/**
 * RETURN: Post-service return.
 * Handles RESELLABLE vs WASTE.
 */
export async function processReturn(
  sessionItemId: string,
  requestedById: string,
  approvedById: string,
  input: {
    quantity: number;
    reason: string;
    condition: ItemCondition;
  },
) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.sessionItem.findUnique({
      where: { id: sessionItemId },
      include: { product: true, round: true },
    });
    if (!item) throw new HospitalityError("Item not found.", "NOT_FOUND");
    if (input.quantity > item.qty) {
      throw new HospitalityError("Return quantity exceeds ordered quantity.");
    }

    await claimActiveItem(tx, sessionItemId, ItemStatus.RETURNED);

    if (item.product.trackInventory && item.inventoryLocationId) {
      if (input.condition === ItemCondition.RESELLABLE) {
        await applyLocationDelta(tx, {
          productId: item.productId,
          locationId: item.inventoryLocationId,
          delta: input.quantity,
          type: "RETURN",
          performedById: approvedById,
          referenceId: sessionItemId,
          reason: `RETURN (RESELLABLE): ${input.reason}`,
        });
      } else {
        await applyLocationDelta(tx, {
          productId: item.productId,
          locationId: item.inventoryLocationId,
          delta: 0,
          type: "WASTE",
          performedById: approvedById,
          referenceId: sessionItemId,
          reason: `RETURN (${input.condition}): ${input.reason}`,
          note: "Return condition prevented stock restoration.",
        });
      }
    }

    await tx.orderAdjustment.create({
      data: {
        sessionId: item.round.sessionId,
        type: AdjustmentType.RETURN,
        originalItemId: sessionItemId,
        quantity: input.quantity,
        reason: input.reason,
        condition: input.condition,
        requestedById,
        approvedById,
      },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId: item.round.sessionId,
        staffId: approvedById,
        action: StaffActionType.RETURN_PROCESSED,
        note: `Returned item ${sessionItemId}. Requested by ${requestedById}.`,
      },
    });

    return item;
  }, adjustmentTx);
}

/**
 * EXCHANGE: Atomic restoration + deduction.
 */
export async function processExchange(
  originalItemId: string,
  requestedById: string,
  approvedById: string,
  replacement: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  },
  reason: string,
  condition: ItemCondition = ItemCondition.RESELLABLE,
) {
  return await prisma.$transaction(async (tx) => {
    const original = await tx.sessionItem.findUnique({
      where: { id: originalItemId },
      include: { product: true, round: { include: { session: true } } },
    });
    if (!original) throw new HospitalityError("Item not found.", "NOT_FOUND");

    await claimActiveItem(tx, originalItemId, ItemStatus.EXCHANGED);

    if (original.product.trackInventory && original.inventoryLocationId && condition === ItemCondition.RESELLABLE) {
      await applyLocationDelta(tx, {
        productId: original.productId,
        locationId: original.inventoryLocationId,
        delta: original.qty,
        type: "ORDER_VOID",
        performedById: approvedById,
        referenceId: originalItemId,
        reason: `EXCHANGE (RESTORE): ${reason}`,
      });
    }

    const replacementProduct = await tx.product.findUniqueOrThrow({
      where: { id: replacement.productId },
    });
    const replacementLocId = await sellingLocationId(tx, replacementProduct);

    const replacementItem = await tx.sessionItem.create({
      data: {
        roundId: original.roundId,
        productId: replacement.productId,
        productVariantId: replacement.variantId,
        qty: replacement.quantity,
        unitPrice: replacement.unitPrice,
        unitCost: replacementProduct.costPrice,
        inventoryLocationId: replacementLocId,
        status: ItemStatus.ACTIVE,
        fulfillmentStatus: FulfillmentStatus.POSTED,
      },
    });

    if (replacementProduct.trackInventory) {
      await applyLocationDelta(tx, {
        productId: replacement.productId,
        locationId: replacementLocId,
        delta: -replacement.quantity,
        type: "SESSION_POST",
        performedById: approvedById,
        referenceId: replacementItem.id,
        reason: `EXCHANGE (DEDUCT): ${reason}`,
      });
    }

    await tx.orderAdjustment.create({
      data: {
        sessionId: original.round.sessionId,
        type: AdjustmentType.EXCHANGE,
        originalItemId: originalItemId,
        replacementItemId: replacementItem.id,
        quantity: original.qty,
        reason,
        condition,
        requestedById,
        approvedById,
      },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId: original.round.sessionId,
        staffId: approvedById,
        action: StaffActionType.EXCHANGE_PROCESSED,
        note: `Exchanged item ${originalItemId} → ${replacementItem.id}. Requested by ${requestedById}.`,
      },
    });

    return replacementItem;
  }, adjustmentTx);
}

/**
 * FULFILLMENT STATUS TRANSITION
 */
export async function updateFulfillment(
  sessionItemId: string,
  staffId: string,
  status: FulfillmentStatus
) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.sessionItem.findUniqueOrThrow({
      where: { id: sessionItemId },
    });

    // Validate Transition (Simple linear flow for now)
    const order = [
      FulfillmentStatus.POSTED,
      FulfillmentStatus.PREPARING,
      FulfillmentStatus.READY,
      FulfillmentStatus.SERVED,
    ];
    const currentIndex = order.indexOf(item.fulfillmentStatus);
    const nextIndex = order.indexOf(status);

    if (nextIndex !== currentIndex + 1) {
      throw new HospitalityError(`Invalid fulfillment transition: ${item.fulfillmentStatus} -> ${status}`);
    }

    // Update Item
    await tx.sessionItem.update({
      where: { id: sessionItemId },
      data: {
        fulfillmentStatus: status,
        fulfillmentStaffId: staffId,
        servedAt: status === FulfillmentStatus.SERVED ? new Date() : undefined,
      },
    });

    // Record History
    await tx.sessionItemFulfillmentHistory.create({
      data: {
        sessionItemId,
        status,
        staffId,
      },
    });

    return item;
  });
}

/**
 * HANDOVER
 */
export async function processHandover(
  sessionId: string,
  newWaiterId: string,
  managerId: string,
  reason: string
) {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.serviceSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const oldWaiterId = session.waiterId;

    await tx.serviceSession.update({
      where: { id: sessionId },
      data: { waiterId: newWaiterId },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId,
        staffId: newWaiterId,
        previousStaffId: oldWaiterId,
        action: StaffActionType.HANDOVER,
        note: `Authorized by ${managerId}. Reason: ${reason}`,
      },
    });
  });
}

/**
 * AGGREGATION HELPER FOR RECEIPTS
 */
export function aggregateSessionItems(items: Array<{
  productId: string;
  productVariantId: string | null;
  unitPrice: Prisma.Decimal;
  qty: number;
  status: ItemStatus;
}>) {
  const activeItems = items.filter(i => i.status === ItemStatus.ACTIVE);
  const groups: Record<string, {
    productId: string;
    variantId: string | null;
    unitPrice: Prisma.Decimal;
    totalQty: number;
  }> = {};

  for (const item of activeItems) {
    const key = `${item.productId}-${item.productVariantId ?? "none"}-${item.unitPrice.toString()}`;
    if (!groups[key]) {
      groups[key] = {
        productId: item.productId,
        variantId: item.productVariantId,
        unitPrice: item.unitPrice,
        totalQty: 0,
      };
    }
    groups[key].totalQty += item.qty;
  }

  return Object.values(groups);
}

export type OpenSessionInput = {
  channel: ServiceChannel;
  tableId?: string;
  destinationLabel?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
};

export async function openServiceSession(waiterId: string, input: OpenSessionInput) {
  const destinationLabel = input.destinationLabel?.trim() || undefined;
  const customerName = input.customerName?.trim() || undefined;
  const customerPhone = input.customerPhone?.trim() || undefined;
  const deliveryAddress = input.deliveryAddress?.trim() || undefined;

  if (input.channel === ServiceChannel.TABLE && !input.tableId) {
    throw new HospitalityError("Select a table.");
  }
  if (input.channel === ServiceChannel.ACCOMMODATION && !destinationLabel) {
    throw new HospitalityError("Room or destination is required.");
  }
  if (
    (input.channel === ServiceChannel.COUNTER || input.channel === ServiceChannel.TAKEAWAY) &&
    !destinationLabel
  ) {
    throw new HospitalityError("Destination label is required.");
  }
  if (input.channel === ServiceChannel.DELIVERY && (!customerName || !customerPhone || !deliveryAddress)) {
    throw new HospitalityError("Delivery requires customer name, phone, and address.");
  }

  return prisma.$transaction(async (tx) => {
    if (input.channel === ServiceChannel.TABLE && input.tableId) {
      const table = await tx.table.findUnique({ where: { id: input.tableId } });
      if (!table || !tableCanStartService(table)) {
        throw new HospitalityError("Table is not available.", "CONFLICT");
      }
      await tx.table.update({ where: { id: input.tableId }, data: { status: "OCCUPIED" } });
    }

    const created = await tx.serviceSession.create({
      data: {
        channel: input.channel,
        waiterId,
        tableId: input.channel === ServiceChannel.TABLE ? input.tableId : null,
        destinationLabel,
        customerName,
        customerPhone,
        deliveryAddress,
        status: SessionStatus.ACTIVE,
      },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId: created.id,
        staffId: waiterId,
        action: StaffActionType.OPENED,
        note: `Session opened for ${input.channel} at ${destinationLabel || input.tableId || "N/A"}`,
      },
    });

    return created;
  });
}

const settlementTx = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
};

function asMoney(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

export type SettlementPaymentInput = {
  method: PaymentMethod;
  amount: number;
  cashReceived?: number;
};

export type SettlementInput = {
  idempotencyKey: string;
  payments: SettlementPaymentInput[];
  creditAmount?: number;
  chargeToRoom?: boolean;
  customerName?: string;
  customerPhone?: string;
  approvedById?: string;
};

const saleInclude = { payments: true, creditBill: true, items: true } as const;

/**
 * SETTLEMENT: Financial finalization only.
 * Must never deduct, restore, or write inventory.
 */
export async function finalizeSettlement(
  sessionId: string,
  settledById: string,
  input: SettlementInput,
) {
  if (!input.idempotencyKey?.trim()) {
    throw new HospitalityError("Settlement key is required.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: saleInclude,
    });
    if (existing) {
      if (existing.sessionId !== sessionId) {
        throw new HospitalityError("This settlement key was already used.", "CONFLICT");
      }
      return existing;
    }

    const claimed = await tx.serviceSession.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE },
      data: {
        status: SessionStatus.SETTLING,
        requestedSettlementAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      const current = await tx.serviceSession.findUnique({
        where: { id: sessionId },
        include: { sale: { include: saleInclude } },
      });
      if (!current) throw new HospitalityError("Session not found.", "NOT_FOUND");
      if (current.sale?.idempotencyKey === input.idempotencyKey) return current.sale;
      if (current.sale || current.status === SessionStatus.CLOSED) {
        throw new HospitalityError("This session is already settled.", "CONFLICT");
      }
      throw new HospitalityError("This session cannot be settled.", "CONFLICT");
    }

    const session = await tx.serviceSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { rounds: { include: { items: true } }, table: true },
    });

    await tx.sessionStaffHistory.create({
      data: {
        sessionId,
        staffId: settledById,
        action: StaffActionType.SETTLEMENT_REQUESTED,
        note: "Settlement started.",
      },
    });

    const activeItems = session.rounds.flatMap((round) => round.items).filter((item) => item.status === ItemStatus.ACTIVE);
    if (activeItems.length === 0) {
      throw new HospitalityError("No active items to settle.");
    }

    const subtotal = activeItems.reduce(
      (sum, item) => sum.add(item.unitPrice.mul(item.qty)),
      new Prisma.Decimal(0),
    );
    const settings = await tx.businessSettings.findUnique({ where: { id: "default" } });
    const tax = settings?.taxEnabled
      ? subtotal.mul(settings.taxRate).div(100).toDecimalPlaces(2)
      : new Prisma.Decimal(0);
    const total = subtotal.add(tax).toDecimalPlaces(2);

    if (input.payments.some((payment) => payment.amount <= 0)) {
      throw new HospitalityError("Payment amounts must be greater than zero.");
    }

    const paid = input.payments.reduce((sum, payment) => sum.add(asMoney(payment.amount)), new Prisma.Decimal(0));
    const creditAmount = asMoney(input.creditAmount ?? 0);
    if (creditAmount.lessThan(0)) {
      throw new HospitalityError("Credit amount is invalid.");
    }
    if (paid.greaterThan(total)) {
      throw new HospitalityError("Payment exceeds the invoice total.");
    }
    if (paid.add(creditAmount).lessThan(total)) {
      throw new HospitalityError("Remaining balance must be paid or converted to credit.");
    }
    if (paid.add(creditAmount).greaterThan(total)) {
      throw new HospitalityError("Payments and credit must equal the invoice total.");
    }

    const chargeToRoom = Boolean(input.chargeToRoom);
    if (chargeToRoom) {
      if (session.channel !== ServiceChannel.ACCOMMODATION) {
        throw new HospitalityError("Charge to room is only available for accommodation.");
      }
      if (!session.destinationLabel?.trim()) {
        throw new HospitalityError("Charge to room requires a room or destination.");
      }
      if (creditAmount.lessThanOrEqualTo(0)) {
        throw new HospitalityError("Charge to room requires a credit balance.");
      }
    }

    if (creditAmount.greaterThan(0) && !input.approvedById) {
      throw new HospitalityError("Manager approval is required for credit.");
    }

    const customerName =
      input.customerName?.trim() ||
      session.customerName?.trim() ||
      (chargeToRoom ? `Room ${session.destinationLabel}` : "");
    if (creditAmount.greaterThan(0) && !customerName) {
      throw new HospitalityError("Customer name is required for credit.");
    }

    for (const payment of input.payments) {
      if (payment.cashReceived == null) continue;
      if (asMoney(payment.cashReceived).lessThan(asMoney(payment.amount))) {
        throw new HospitalityError("Cash received is less than the applied amount.");
      }
    }

    const productIds = [...new Set(activeItems.map((item) => item.productId))];
    const variantIds = [...new Set(activeItems.map((item) => item.productVariantId).filter((id): id is string => Boolean(id)))];
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const variants = variantIds.length
      ? await tx.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    const receiptSeq = await tx.businessSettings.update({
      where: { id: "default" },
      data: { receiptSequence: { increment: 1 } },
    });
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" }).replaceAll("-", "");
    const receiptNumber = `BZ-${day}-${String(receiptSeq.receiptSequence).padStart(6, "0")}`;

    const saleChange = input.payments.reduce((sum, payment) => {
      if (payment.cashReceived == null) return sum;
      return sum.add(asMoney(payment.cashReceived).sub(asMoney(payment.amount)));
    }, new Prisma.Decimal(0));

    let sale;
    try {
      sale = await tx.sale.create({
        data: {
          receiptNumber,
          idempotencyKey: input.idempotencyKey,
          cashierId: settledById,
          sessionId: session.id,
          customerName: customerName || session.customerName,
          subtotal,
          tax,
          total,
          amountPaid: paid,
          change: saleChange,
          paymentMethod: input.payments[0]?.method ?? PaymentMethod.OTHER,
          status: "COMPLETED",
          note: chargeToRoom ? `Charge to room ${session.destinationLabel}` : undefined,
          items: {
            create: activeItems.map((item) => {
              const product = productById.get(item.productId);
              const variant = item.productVariantId ? variantById.get(item.productVariantId) : undefined;
              return {
                productId: item.productId,
                productVariantId: item.productVariantId,
                productName: variant ? `${product?.name} (${variant.name})` : (product?.name || "Unknown"),
                productSku: variant?.sku || product?.sku || "",
                variantName: variant?.name || null,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                quantity: item.qty,
                lineSubtotal: item.unitPrice.mul(item.qty),
                inventoryLocationId: item.inventoryLocationId,
              };
            }),
          },
          ...(input.payments.length > 0
            ? {
                payments: {
                  create: input.payments.map((payment) => ({
                    method: payment.method,
                    amount: asMoney(payment.amount),
                    cashReceived: payment.cashReceived != null ? asMoney(payment.cashReceived) : null,
                    change:
                      payment.cashReceived != null
                        ? asMoney(payment.cashReceived).sub(asMoney(payment.amount))
                        : null,
                    receivedById: settledById,
                  })),
                },
              }
            : {}),
        },
        include: saleInclude,
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const duplicate = await tx.sale.findFirst({
          where: {
            OR: [{ idempotencyKey: input.idempotencyKey }, { sessionId }],
          },
          include: saleInclude,
        });
        if (duplicate?.idempotencyKey === input.idempotencyKey) return duplicate;
        throw new HospitalityError("This session is already settled.", "CONFLICT");
      }
      throw error;
    }

    if (creditAmount.greaterThan(0)) {
      await tx.creditBill.create({
        data: {
          saleId: sale.id,
          sessionId: session.id,
          customerName,
          customerPhone: input.customerPhone ?? session.customerPhone,
          total: creditAmount,
          balance: creditAmount,
          status: CreditStatus.OUTSTANDING,
          approvedById: input.approvedById,
        },
      });
    }

    await tx.serviceSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.CLOSED, closedAt: new Date() },
    });

    if (session.tableId) {
      await tx.table.update({
        where: { id: session.tableId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.sessionStaffHistory.create({
      data: {
        sessionId,
        staffId: settledById,
        action: StaffActionType.SETTLED,
        note: creditAmount.greaterThan(0)
          ? `Settled sale ${sale.receiptNumber}. Paid ${paid.toFixed(2)}. Credit ${creditAmount.toFixed(2)}.`
          : `Settled with sale ${sale.receiptNumber}. Total: ${total.toFixed(2)}`,
      },
    });

    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: saleInclude,
    });
  }, settlementTx);
}

export async function recordCreditPayment(
  creditBillId: string,
  receivedById: string,
  input: {
    amount: number;
    method: PaymentMethod;
    idempotencyKey: string;
  },
) {
  if (!input.idempotencyKey?.trim()) {
    throw new HospitalityError("Payment key is required.");
  }
  const amount = asMoney(input.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new HospitalityError("Payment amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditPayment.findUnique({
      where: { id: input.idempotencyKey },
      include: { creditBill: true },
    });
    if (existing) {
      if (existing.creditBillId !== creditBillId) {
        throw new HospitalityError("This payment key was already used.", "CONFLICT");
      }
      return existing;
    }

    const bill = await tx.creditBill.findUnique({ where: { id: creditBillId } });
    if (!bill) throw new HospitalityError("Credit bill not found.");
    if (bill.status === CreditStatus.PAID || bill.status === CreditStatus.WRITTEN_OFF) {
      throw new HospitalityError("This credit bill cannot accept payments.", "CONFLICT");
    }
    if (amount.greaterThan(bill.balance)) {
      throw new HospitalityError("Payment exceeds the outstanding credit balance.");
    }

    const nextBalance = bill.balance.sub(amount).toDecimalPlaces(2);
    const nextStatus = nextBalance.equals(0) ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;
    const claimed = await tx.creditBill.updateMany({
      where: {
        id: bill.id,
        balance: bill.balance,
        status: { in: [CreditStatus.OUTSTANDING, CreditStatus.PARTIALLY_PAID] },
      },
      data: { balance: nextBalance, status: nextStatus },
    });
    if (claimed.count !== 1) {
      throw new HospitalityError("This credit bill was already updated.", "CONFLICT");
    }

    try {
      return await tx.creditPayment.create({
        data: {
          id: input.idempotencyKey,
          creditBillId,
          amount,
          method: input.method,
          receivedById,
        },
        include: { creditBill: true },
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const duplicate = await tx.creditPayment.findUnique({
          where: { id: input.idempotencyKey },
          include: { creditBill: true },
        });
        if (duplicate?.creditBillId === creditBillId) return duplicate;
        throw new HospitalityError("This payment key was already used.", "CONFLICT");
      }
      throw error;
    }
  }, settlementTx);
}
