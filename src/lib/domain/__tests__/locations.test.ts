import { describe, expect, it } from "vitest";
import { visibleStockLocations } from "@/lib/domain/locations";

describe("visibleStockLocations", () => {
  it("shows Main + Bar for a bar product and hides empty Kitchen/Cafe", () => {
    expect(
      visibleStockLocations({
        main: 20,
        bar: 20,
        kitchen: 0,
        cafe: 0,
        defaultLocationCode: "BAR",
      }).map((row) => row.code),
    ).toEqual(["MAIN", "BAR"]);
  });

  it("shows Main + Kitchen for a kitchen product", () => {
    expect(
      visibleStockLocations({
        main: 5,
        bar: 0,
        kitchen: 12,
        cafe: 0,
        defaultLocationCode: "KITCHEN",
      }).map((row) => row.code),
    ).toEqual(["MAIN", "KITCHEN"]);
  });

  it("shows Main + Cafe for a cafe product", () => {
    expect(
      visibleStockLocations({
        main: 3,
        bar: 0,
        kitchen: 0,
        cafe: 8,
        defaultLocationCode: "CAFE",
      }).map((row) => row.code),
    ).toEqual(["MAIN", "CAFE"]);
  });

  it("still shows an unexpected location when it already has stock", () => {
    expect(
      visibleStockLocations({
        main: 1,
        bar: 4,
        kitchen: 2,
        cafe: 0,
        defaultLocationCode: "BAR",
      }).map((row) => row.code),
    ).toEqual(["MAIN", "BAR", "KITCHEN"]);
  });
});
