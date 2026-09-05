import { BusinessArea, ProductType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  commandeStationForProduct,
  commandeStationLabel,
  splitItemsByCommandeStation,
} from "@/lib/domain/commande-slip";

describe("commande slip stations", () => {
  it("sends kitchen menu to the kitchen slip and drinks to bar/cafe", () => {
    expect(
      commandeStationForProduct({ categoryArea: BusinessArea.KITCHEN }),
    ).toBe("KITCHEN");
    expect(commandeStationForProduct({ categoryArea: BusinessArea.BAR })).toBe("BAR_CAFE");
    expect(commandeStationForProduct({ categoryArea: BusinessArea.CAFE })).toBe("BAR_CAFE");
    expect(
      commandeStationForProduct({
        categoryArea: BusinessArea.OTHER,
        productType: ProductType.RAW_MATERIAL,
      }),
    ).toBe("KITCHEN");
  });

  it("prints two slips when an order mixes kitchen and bar/cafe items", () => {
    const stationByProductId = new Map([
      ["pizza", "KITCHEN" as const],
      ["beer", "BAR_CAFE" as const],
      ["coffee", "BAR_CAFE" as const],
    ]);
    const slips = splitItemsByCommandeStation(
      [
        { productId: "pizza", name: "Pizza" },
        { productId: "beer", name: "Amstel" },
        { productId: "coffee", name: "Latte" },
      ],
      stationByProductId,
    );
    expect(slips).toHaveLength(2);
    expect(slips[0]).toEqual({
      station: "KITCHEN",
      items: [{ productId: "pizza", name: "Pizza" }],
    });
    expect(slips[1]?.station).toBe("BAR_CAFE");
    expect(slips[1]?.items).toHaveLength(2);
    expect(commandeStationLabel("KITCHEN")).toBe("Kitchen");
    expect(commandeStationLabel("BAR_CAFE")).toBe("Bar / Cafe");
  });
});
