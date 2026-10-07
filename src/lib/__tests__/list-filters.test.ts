import { describe, expect, it } from "vitest";
import { dateRange, singleParam, validAmountParam, validDateParam } from "@/lib/list-filters";

describe("list filter query parsing", () => {
  it("accepts one string query value and rejects repeated values", () => {
    expect(singleParam({ q: "  coffee  " }, "q")).toBe("coffee");
    expect(singleParam({ q: ["coffee", "tea"] }, "q")).toBe("");
  });

  it("bounds query text length", () => {
    expect(singleParam({ q: "x".repeat(200) }, "q")).toHaveLength(120);
  });

  it("accepts valid calendar dates only", () => {
    expect(validDateParam("2026-10-07")).toBe(true);
    expect(validDateParam("2026-02-30")).toBe(false);
    expect(validDateParam("07-10-2026")).toBe(false);
  });

  it("defaults date filters to today and treats a single selected date as one day", () => {
    const today = dateRange({});
    expect(today.fromValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today.toValue).toBe(today.fromValue);
    expect(today.from?.getTime()).toBeLessThan(today.to?.getTime() ?? 0);

    const historical = dateRange({ from: "2026-10-05" });
    expect(historical.fromValue).toBe("2026-10-05");
    expect(historical.toValue).toBe("2026-10-05");
    expect(historical.from?.getTime()).toBeLessThan(historical.to?.getTime() ?? 0);
  });

  it("preserves an explicitly selected date range", () => {
    const range = dateRange({ from: "2026-10-01", to: "2026-10-05" });
    expect(range.fromValue).toBe("2026-10-01");
    expect(range.toValue).toBe("2026-10-05");
    expect(range.from?.getTime()).toBeLessThan(range.to?.getTime() ?? 0);
  });

  it("accepts non-negative safe integer amounts only", () => {
    expect(validAmountParam("1200")).toBe(1200);
    expect(validAmountParam("0")).toBe(0);
    expect(validAmountParam("-1")).toBeUndefined();
    expect(validAmountParam("1.5")).toBeUndefined();
    expect(validAmountParam("9007199254740992")).toBeUndefined();
  });
});
