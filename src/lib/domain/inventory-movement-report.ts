import { MovementType } from "@prisma/client";

export type MovementReportBuckets = {
  received: number;
  sold: number;
  returned: number;
  wasted: number;
  adjusted: number;
  transferIn: number;
  transferOut: number;
};

export function emptyMovementBuckets(): MovementReportBuckets {
  return {
    received: 0,
    sold: 0,
    returned: 0,
    wasted: 0,
    adjusted: 0,
    transferIn: 0,
    transferOut: 0,
  };
}

/**
 * Fold one InventoryMovement into report buckets.
 * Uses signed ledger quantities as stored by applyStockChange — no double counting.
 */
export function accumulateMovementReport(
  buckets: MovementReportBuckets,
  type: MovementType,
  quantity: number,
): MovementReportBuckets {
  switch (type) {
    case MovementType.PURCHASE:
      buckets.received += quantity;
      break;
    case MovementType.SALE:
      buckets.sold += Math.abs(quantity);
      break;
    case MovementType.VOID_RESTORE:
      buckets.returned += quantity;
      break;
    case MovementType.WASTE:
      buckets.wasted += Math.abs(quantity);
      break;
    case MovementType.ADJUSTMENT:
    case MovementType.COUNT:
      buckets.adjusted += quantity;
      break;
    case MovementType.TRANSFER_IN:
      buckets.transferIn += quantity;
      break;
    case MovementType.TRANSFER_OUT:
      buckets.transferOut += Math.abs(quantity);
      break;
    default:
      break;
  }
  return buckets;
}
