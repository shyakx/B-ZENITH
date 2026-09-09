import { describe, expect, it } from "vitest";
import { rwandaDayRange } from "@/lib/dates";
import { buildOrderListWhere } from "@/services/orders";

describe("buildOrderListWhere current-day filter", () => {
  it("scopes createdAt to the business-day window when from/to are provided", () => {
    const day = rwandaDayRange("2026-09-09");
    const where = buildOrderListWhere({ from: day.from, to: day.to });
    expect(where.createdAt).toEqual({ gte: day.from, lte: day.to });
  });

  it("omits createdAt when listing without a day filter (reports / open bills)", () => {
    const where = buildOrderListWhere({ openOnly: true });
    expect(where.createdAt).toBeUndefined();
    expect(where.status).toBe("OPEN");
  });
});
