import { describe, expect, it } from "vitest";
import { rwandaDayRange } from "@/lib/dates";
import { selectCurrentDayOrders } from "@/lib/domain/operational-orders";

describe("selectCurrentDayOrders", () => {
  const day = rwandaDayRange("2026-09-09");
  const yesterday = rwandaDayRange("2026-09-08");

  const older = {
    id: "old",
    createdAt: new Date(yesterday.from.getTime() + 12 * 60 * 60 * 1000),
  };
  const morning = {
    id: "am",
    createdAt: new Date(day.from.getTime() + 4 * 60 * 60 * 1000),
  };
  const afternoon = {
    id: "pm",
    createdAt: new Date(day.from.getTime() + 10 * 60 * 60 * 1000),
  };
  const evening = {
    id: "eve",
    createdAt: new Date(day.from.getTime() + 15 * 60 * 60 * 1000),
  };

  it("shows only today's orders and excludes older dates", () => {
    const result = selectCurrentDayOrders([older, morning, afternoon], day.from, day.to);
    expect(result.map((row) => row.id)).toEqual(["pm", "am"]);
    expect(result.some((row) => row.id === "old")).toBe(false);
  });

  it("sorts newest → oldest by createdAt", () => {
    const result = selectCurrentDayOrders([morning, evening, afternoon], day.from, day.to);
    expect(result.map((row) => row.id)).toEqual(["eve", "pm", "am"]);
  });

  it("does not remove historical orders from an unfiltered source list", () => {
    const historical = [older, morning];
    expect(historical).toHaveLength(2);
    expect(selectCurrentDayOrders(historical, day.from, day.to)).toHaveLength(1);
    expect(historical).toHaveLength(2);
  });
});
