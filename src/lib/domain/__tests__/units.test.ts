import { describe, expect, it } from "vitest";
import { flattenCatalogProducts, trackedProductBaseUnitCode } from "../../../../prisma/catalog-data";
import {
  assertStockInReceiveUnit,
  canReceiveProduct,
  isPourUnit,
  preferredStockInUnitId,
  preferredTransferUnitId,
  quantityWithUnit,
  stockInUnitsForProduct,
  transferUnitsForProduct,
  unitLabel,
} from "@/lib/domain/units";

describe("unit labels", () => {
  it("uses friendly unit names", () => {
    expect(unitLabel("BOTTLE")).toBe("Bottle");
    expect(unitLabel("SHOT")).toBe("Shot");
    expect(unitLabel("GLASS")).toBe("Glass");
    expect(unitLabel("CRATE")).toBe("Crate");
    expect(unitLabel("KG")).toBe("Kg");
    expect(quantityWithUnit(100, "Bottle")).toBe("100 bottles");
    expect(quantityWithUnit(1, "Shot")).toBe("1 shot");
    expect(quantityWithUnit(16, "Shot")).toBe("16 shots");
    expect(quantityWithUnit(1, "Glass")).toBe("1 glass");
    expect(quantityWithUnit(12, "Glass")).toBe("12 glasses");
    expect(quantityWithUnit(1, "Crate")).toBe("1 crate");
    expect(quantityWithUnit(20, "Kg")).toBe("20 Kg");
  });
});

describe("tracked product base units", () => {
  it("maps Shot and Glass SKUs without treating Petit/Grand as shots", () => {
    expect(trackedProductBaseUnitCode("Gordon Gin Shot")).toBe("SHOT");
    expect(trackedProductBaseUnitCode("Pinta Negra Red Glass")).toBe("GLASS");
    expect(trackedProductBaseUnitCode("Gordon Gin Bottle")).toBe("BOTTLE");
    expect(trackedProductBaseUnitCode("Konyagi Petit")).toBe("BOTTLE");
    expect(trackedProductBaseUnitCode("Gilbeys Grand")).toBe("BOTTLE");
    expect(trackedProductBaseUnitCode("Petit Skol Malt")).toBe("BOTTLE");
  });

  it("classifies the 48 tracked drink products", () => {
    const tracked = flattenCatalogProducts().filter((product) => product.productType === "PACKAGED_GOOD");
    const namesFor = (unit: "SHOT" | "GLASS" | "BOTTLE") =>
      tracked.filter((product) => trackedProductBaseUnitCode(product.name) === unit).map((product) => product.name);
    expect(tracked).toHaveLength(48);
    expect(namesFor("SHOT").sort()).toEqual([
      "Absolut Vodka Shot",
      "Baileys Shot",
      "Gordon Gin Shot",
      "Hennessy VS Shot",
      "Hennessy VSOP Shot",
      "Jack Daniel Shot",
      "Jameson Shot",
      "Tequila Camino Shot",
    ]);
    expect(namesFor("GLASS").sort()).toEqual([
      "Pinta Negra Red Glass",
      "Pinta Negra White Glass",
    ]);
    expect(namesFor("BOTTLE")).toHaveLength(38);
  });
});

describe("stock in vs stock out units", () => {
  const shot = { id: "u-shot", code: "SHOT", name: "Shot" };
  const bottle = { id: "u-bottle", code: "BOTTLE", name: "Bottle" };
  const crate = { id: "u-crate", code: "CRATE", name: "Crate" };

  it("treats shots and glasses as pieces, not stock-in units", () => {
    expect(isPourUnit("SHOT")).toBe(true);
    expect(isPourUnit("Glass")).toBe(true);
    expect(isPourUnit("BOTTLE")).toBe(false);
    expect(() => assertStockInReceiveUnit("SHOT")).toThrow(/full bottles or packs/);
    expect(() => assertStockInReceiveUnit("BOTTLE")).not.toThrow();
  });

  it("lets you receive a bottle product, not a shot-only SKU", () => {
    const ginBottle = { baseUnit: bottle, packs: [{ unitId: crate.id, baseQuantity: 12, unit: crate }] };
    const ginShot = { baseUnit: shot, packs: [] };
    expect(canReceiveProduct(ginBottle)).toBe(true);
    expect(canReceiveProduct(ginShot)).toBe(false);
    expect(stockInUnitsForProduct(ginBottle).map((unit) => unit.code)).toEqual(["BOTTLE", "CRATE"]);
    expect(preferredStockInUnitId(ginBottle)).toBe(crate.id);
  });

  it("lets you move pieces to the bar, or a full bottle when a pack exists", () => {
    const countedInShots = {
      baseUnit: shot,
      packs: [{ unitId: bottle.id, baseQuantity: 16, unit: bottle }],
    };
    expect(canReceiveProduct(countedInShots)).toBe(true);
    expect(stockInUnitsForProduct(countedInShots).map((unit) => unit.code)).toEqual(["BOTTLE"]);
    expect(transferUnitsForProduct(countedInShots).map((unit) => unit.code)).toEqual(["SHOT", "BOTTLE"]);
    expect(preferredTransferUnitId(countedInShots)).toBe(shot.id);
  });
});
