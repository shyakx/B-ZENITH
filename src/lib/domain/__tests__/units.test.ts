import { describe, expect, it } from "vitest";
import { flattenCatalogProducts, trackedProductBaseUnitCode } from "../../../../prisma/catalog-data";
import { quantityWithUnit, unitLabel } from "@/lib/domain/units";

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
