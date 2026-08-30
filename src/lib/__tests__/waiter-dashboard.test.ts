import { describe, expect, it } from "vitest";
import { itemQuantity, waiterTodayStats } from "@/lib/waiter-dashboard";

describe("waiter home stats", () => {
  it("counts this waiter's orders, distinct tables, and item quantities", () => {
    const stats = waiterTodayStats([
      {
        tableId: "t7",
        table: { name: "7" },
        items: [{ quantity: 2 }, { quantity: 3 }],
      },
      {
        tableId: "t3",
        table: { name: "3" },
        items: [{ quantity: 1 }],
      },
      {
        tableId: "t7",
        table: { name: "7" },
        items: [{ quantity: 2 }],
      },
    ]);

    expect(stats.orderCount).toBe(3);
    expect(stats.tableCount).toBe(2);
    expect(stats.tableNames).toEqual(["7", "3"]);
    expect(stats.itemCount).toBe(8);
    expect(itemQuantity({ items: [{ quantity: 2 }, { quantity: 3 }] })).toBe(5);
  });
});
