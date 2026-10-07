import { describe, expect, it } from "vitest";
import { OrderStatus, PaymentStatus } from "@prisma/client";
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

  it("combines order status, payment status, table, waiter, total and search filters", () => {
    const where = buildOrderListWhere({
      waiterId: "waiter-1",
      tableId: "table-1",
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      minTotal: 1000,
      maxTotal: 5000,
      search: "42",
    });

    expect(where).toMatchObject({
      waiterId: "waiter-1",
      tableId: "table-1",
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      total: { gte: 1000, lte: 5000 },
      OR: expect.arrayContaining([
        { orderNumber: 42 },
        { table: { name: { contains: "42", mode: "insensitive" } } },
        { waiter: { name: { contains: "42", mode: "insensitive" } } },
        { items: { some: { name: { contains: "42", mode: "insensitive" } } } },
      ]),
    });
  });

  it("filters orders by selected product and category", () => {
    const where = buildOrderListWhere({ productId: "product-1", categoryId: "category-1" });

    expect(where.items).toEqual({
      some: { productId: "product-1", product: { categoryId: "category-1" } },
    });
  });
});
