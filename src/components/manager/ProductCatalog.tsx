"use client";

import { useMemo, useState } from "react";
import { BusinessArea, ProductType } from "@prisma/client";
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
  stockUnit: string;
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
    wholePackageTransfer: boolean;
  };
};

export function ProductCatalog({
  items,
  categories,
  locations,
  units,
}: {
  items: CatalogItem[];
  categories: { id: string; name: string; area: BusinessArea }[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
}) {
  const [tab, setTab] = useState<"menu" | "materials">("menu");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const menu = items.filter((item) => item.productType !== ProductType.RAW_MATERIAL);
  const materials = items.filter((item) => item.productType === ProductType.RAW_MATERIAL);
  const pool = (tab === "menu" ? menu : materials).filter((item) => showInactive || item.active);
  const inactiveCount = (tab === "menu" ? menu : materials).filter((item) => !item.active).length;
  const visible = useMemo(
    () =>
      pool.filter((product) =>
        matchesSearch(
          query,
          product.name,
          product.categoryName,
          categoryAreaStaffLabel(product.categoryArea),
          product.stockUnit,
          product.sellingPrice,
          product.active ? "active" : "inactive",
        ),
      ),
    [pool, query],
  );

  return (
    <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
      <div>
        <h2 className="font-semibold text-zenith-ink">Product list</h2>
      </div>

      <div className="mt-4">
        <ListSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search products (e.g. leffe)…"
          label="Search products"
          showLabel
        />
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "menu" ? "bg-zenith-gold text-white" : "border border-zenith-border bg-white"
          }`}
          onClick={() => setTab("menu")}
        >
          Menu
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

      <div className="mt-3 grid max-h-[70vh] min-w-0 gap-2 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-zenith-border px-3 py-4 text-sm text-zenith-muted">
            {query.trim()
              ? "No products match that search."
              : tab === "materials"
                ? "No stock items yet."
                : "No menu products yet."}
          </p>
        ) : null}
        {visible.map((product) => (
          <article key={product.id} className="min-w-0 rounded-lg border border-zenith-border bg-zenith-raised/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{product.name}</div>
                <div className="mt-1 text-sm text-zenith-muted">
                  {product.categoryName}
                  {product.stockUnit ? ` · ${product.stockUnit}` : ""}
                  {" · "}
                  {product.active ? "Active" : "Inactive"}
                </div>
                <div className="mt-0.5 text-sm">{product.sellingPrice}</div>
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
    </section>
  );
}
