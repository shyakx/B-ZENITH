import { describe, expect, it } from "vitest";
import { MovementType } from "@prisma/client";
import {
  accumulateMovementReport,
  emptyMovementBuckets,
} from "@/lib/domain/inventory-movement-report";
import { formatStockQty } from "@/lib/domain/units";

describe("formatStockQty", () => {
  it("shows official unit codes with quantity", () => {
    expect(formatStockQty(12, "BOTTLE")).toBe("12 BOTTLES");
    expect(formatStockQty(1, "BOTTLE")).toBe("1 BOTTLE");
    expect(formatStockQty(18, "KG")).toBe("18 KG");
    expect(formatStockQty(10, "L")).toBe("10 L");
    expect(formatStockQty(3, "GLASS")).toBe("3 GLASSES");
    expect(formatStockQty(2, "SHOT")).toBe("2 SHOTS");
  });

  it("falls back to bare number when unit missing", () => {
    expect(formatStockQty(5, null)).toBe("5");
    expect(formatStockQty(5, undefined)).toBe("5");
  });
});

describe("accumulateMovementReport", () => {
  it("buckets ledger signs without double counting", () => {
    const buckets = emptyMovementBuckets();
    accumulateMovementReport(buckets, MovementType.PURCHASE, 100);
    accumulateMovementReport(buckets, MovementType.SALE, -35);
    accumulateMovementReport(buckets, MovementType.VOID_RESTORE, 2);
    accumulateMovementReport(buckets, MovementType.WASTE, -2);
    accumulateMovementReport(buckets, MovementType.ADJUSTMENT, 1);
    accumulateMovementReport(buckets, MovementType.COUNT, -1);
    accumulateMovementReport(buckets, MovementType.TRANSFER_IN, 10);
    accumulateMovementReport(buckets, MovementType.TRANSFER_OUT, -10);

    expect(buckets).toEqual({
      received: 100,
      sold: 35,
      returned: 2,
      wasted: 2,
      adjusted: 0,
      transferIn: 10,
      transferOut: 10,
    });
  });
});
