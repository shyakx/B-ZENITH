"use client";

import { useMemo, useState } from "react";
import { BusinessArea, ProductType } from "@prisma/client";
import { EnsureKitchenStoresButton } from "@/components/manager/EnsureKitchenStoresButton";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { ProductEditor } from "@/components/manager/ProductForm";
import { categoryAreaStaffLabel } from "@/lib/product-type-labels";

type CatalogItem = {
  id: string;
  name: string;
  categoryName: string;
  categoryArea: BusinessArea;
  sellingPrice: string;
  productType: ProductType;
  sellOnPos: boolean;
  active: boolean;
  trackInventory: boolean;
  stockLine: string;
  editor: {
    id: string;
    name: string;
    categoryId: string;
    sellingPrice: number;
    costPrice: number | null;
    trackInventory: boolean;
    active: boolean;
    productType: ProductType;
    sellOnPos: boolean;
    baseUnitId: string | null;
    defaultStockLocationId: string | null;
    purchaseUnitId: string | null;
    purchaseContains: number | null;
  };
};

export function ProductCatalog({
  items,
  categories,
  locations,
  units,
  kitchenMissing = 0,
}: {
  items: CatalogItem[];
  categories: { id: string; name: string; area: BusinessArea }[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  kitchenMissing?: number;
}) {
  const [tab, setTab] = useState<"menu" | "materials">("menu");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const menu = items.filter((item) => item.productType !== ProductType.RAW_MATERIAL);
  const materials = items.filter((item) => item.productType === ProductType.RAW_MATERIAL);
  const pool = (tab === "menu" ? menu : materials).filter(
    (item) => showInactive || item.active,
  );
  const inactiveCount = (tab === "menu" ? menu : materials).filter((item) => !item.active).length;
  const visible = useMemo(
    () =>
      pool.filter((product) =>
        matchesSearch(
          query,
          product.name,
          product.categoryName,
          categoryAreaStaffLabel(product.categoryArea),
          product.sellingPrice,
          product.stockLine,
          product.sellOnPos ? "on pos" : "not on pos",
          product.active ? "active" : "inactive",
        ),
      ),
    [pool, query],
  );

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "menu" ? "bg-zenith-gold text-white" : "border border-zenith-border bg-white"
          }`}
          onClick={() => setTab("menu")}
        >
          Menu Products
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "materials" ? "bg-zenith-gold text-white" : "border border-zenith-border bg-white"
          }`}
          onClick={() => setTab("materials")}
        >
          Stock items
        </button>
        {inactiveCount > 0 ? (
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              showInactive ? "bg-zenith-raised text-zenith-gold" : "border border-zenith-border bg-white"
            }`}
            onClick={() => setShowInactive((value) => !value)}
          >
            {showInactive ? "Hide inactive" : `Show inactive (${inactiveCount})`}
          </button>
        ) : null}
      </div>
      <ListSearchField
        value={query}
        onChange={setQuery}
        placeholder={tab === "menu" ? "Search menu products…" : "Search stock items…"}
      />
      {tab === "materials" ? <EnsureKitchenStoresButton missing={kitchenMissing} /> : null}
      <div className={`grid min-w-0 gap-2 ${tab === "materials" && kitchenMissing > 0 ? "mt-3" : ""}`}>
        {visible.length === 0 ? (
          <p className="text-sm text-zenith-muted">
            {query.trim()
              ? "No products match that search."
              : tab === "materials"
                ? kitchenMissing === 0
                  ? "No stock items yet."
                  : null
                : "No menu products yet."}
          </p>
        ) : null}
        {visible.map((product) => (
          <article key={product.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{product.name}</div>
                <div className="mt-1 inline-flex rounded-lg bg-zenith-raised px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zenith-gold">
                  {product.categoryName} · {categoryAreaStaffLabel(product.categoryArea)}
                </div>
                <div className="mt-1 text-sm">
                  {product.sellingPrice} · {product.sellOnPos ? "On POS" : "Not on POS"} ·{" "}
                  {product.active ? "Active" : "Inactive"}
                </div>
                <div className="text-sm text-zenith-muted">Stock · {product.stockLine}</div>
              </div>
              <ProductEditor
                categories={categories}
                locations={locations}
                units={units}
                product={product.editor}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
