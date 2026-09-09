import { describe, expect, it } from "vitest";
import {
  catalogNameSimilarity,
  findSimilarCatalogNames,
  normalizeCatalogName,
} from "@/lib/domain/name-similarity";

describe("normalizeCatalogName", () => {
  it("ignores case, outer spaces, and repeated spaces/punctuation", () => {
    expect(normalizeCatalogName("  LEFFE  ")).toBe("leffe");
    expect(normalizeCatalogName("Leffe")).toBe("leffe");
    expect(normalizeCatalogName("Beer   &   Drinks")).toBe("beer drinks");
    expect(normalizeCatalogName("Water-500ml")).toBe("water 500ml");
  });
});

describe("catalogNameSimilarity", () => {
  it("flags exact normalized duplicates", () => {
    expect(catalogNameSimilarity("leffe", "Leffe")).toBe("exact");
    expect(catalogNameSimilarity(" Beer ", "beer")).toBe("exact");
  });

  it("flags obvious near spelling matches", () => {
    expect(catalogNameSimilarity("Reffe", "Leffe")).toBe("near");
    expect(catalogNameSimilarity("Beers", "Beer")).toBe("near");
    expect(catalogNameSimilarity("Beer", "Beers & Drinks")).toBe("near");
  });

  it("keeps genuinely different products separate", () => {
    expect(catalogNameSimilarity("Chicken", "Chicken Wings")).toBeNull();
    expect(catalogNameSimilarity("Chicken", "Chicken Burger")).toBeNull();
    expect(catalogNameSimilarity("Water 500ml", "Water 1L")).toBeNull();
    expect(catalogNameSimilarity("Heineken", "Primus")).toBeNull();
  });
});

describe("findSimilarCatalogNames", () => {
  const catalog = [
    { id: "1", name: "Leffe" },
    { id: "2", name: "Chicken" },
    { id: "3", name: "Chicken Wings" },
    { id: "4", name: "Water 500ml" },
    { id: "5", name: "Water 1L" },
    { id: "6", name: "Beer" },
  ];

  it("returns exact and near matches without merging records", () => {
    expect(findSimilarCatalogNames("LEFFE", catalog).map((row) => row.name)).toEqual(["Leffe"]);
    expect(findSimilarCatalogNames("Reffe", catalog)[0]).toMatchObject({ name: "Leffe", kind: "near" });
    expect(findSimilarCatalogNames("beer", catalog)[0]).toMatchObject({ name: "Beer", kind: "exact" });
    expect(findSimilarCatalogNames("Beers & Drinks", catalog)[0]).toMatchObject({
      name: "Beer",
      kind: "near",
    });
  });

  it("does not treat size or extension names as duplicates", () => {
    expect(findSimilarCatalogNames("Chicken Wings", catalog).map((row) => row.name)).toEqual(["Chicken Wings"]);
    expect(findSimilarCatalogNames("Water 1L", catalog).map((row) => row.name)).toEqual(["Water 1L"]);
    expect(findSimilarCatalogNames("Chicken Burger", catalog)).toEqual([]);
  });
});
