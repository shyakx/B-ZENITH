"use client";

import { useState } from "react";
import { BusinessArea, ProductType } from "@prisma/client";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { ProductEditor } from "@/components/manager/ProductForm";
import { categoryAreaStaffLabel, productTypeStaffLabel } from "@/lib/product-type-labels";

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
  defaultLocationName: string;
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
  const [status, setStatus] = useState("active");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("");
  const [area, setArea] = useState("");
  const [pos, setPos] = useState("");
  const [inventory, setInventory] = useState("");
  const [location, setLocation] = useState("");
  const menu = items.filter((item) => item.productType !== ProductType.RAW_MATERIAL);
  const materials = items.filter((item) => item.productType === ProductType.RAW_MATERIAL);
  const pool = tab === "menu" ? menu : materials;
  const availableCategories = categories.filter((category) =>
    pool.some((item) => item.categoryArea === category.area && item.categoryName === category.name),
  );
  const visible = pool.filter((product) => {
      const matchesStatus = status === "all" || (status === "active" ? product.active : !product.active);
      return matchesStatus &&
        (!categoryId || product.editor.categoryId === categoryId) &&
        (!productType || product.productType === productType) &&
        (!area || product.categoryArea === area) &&
        (!pos || product.sellOnPos === (pos === "yes")) &&
        (!inventory || product.trackInventory === (inventory === "tracked")) &&
        (!location ||
          (location === "__none" ? !product.defaultLocationName : product.defaultLocationName === location)) &&
        matchesSearch(
          query,
          product.name,
          product.categoryName,
          categoryAreaStaffLabel(product.categoryArea),
          product.stockUnit,
          product.sellingPrice,
          product.active ? "active" : "inactive",
        );
    });

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
          Products
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
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="">All categories</option>
            {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Product type
          <select value={productType} onChange={(event) => setProductType(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="">All types</option>
            {[...new Set(pool.map((item) => item.productType))].sort().map((value) => <option key={value} value={value}>{productTypeStaffLabel(value)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Business area
          <select value={area} onChange={(event) => setArea(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="">All areas</option>
            {[...new Set(pool.map((item) => item.categoryArea))].sort().map((value) => <option key={value} value={value}>{categoryAreaStaffLabel(value)}</option>)}
          </select>
        </label>
        {tab === "menu" ? (
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            POS menu
            <select value={pos} onChange={(event) => setPos(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
              <option value="">All POS settings</option>
              <option value="yes">On sales menu</option>
              <option value="no">Not on sales menu</option>
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Inventory
          <select value={inventory} onChange={(event) => setInventory(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="">All inventory settings</option>
            <option value="tracked">Tracked</option>
            <option value="untracked">Not tracked</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
          Default location
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="block w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-ink">
            <option value="">All locations</option>
            {[...new Set(pool.map((item) => item.defaultLocationName).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}
            <option value="__none">No default location</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-zenith-muted">{visible.length} products shown.</p>

      <div className="mt-3 grid max-h-[70vh] min-w-0 gap-2 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-zenith-border px-3 py-4 text-sm text-zenith-muted">
            {query.trim()
              ? "No products match these filters."
              : tab === "materials"
                ? "No stock items yet."
                : "No products yet."}
          </p>
        ) : null}
        {visible.map((product) => (
          <article key={product.id} className="min-w-0 rounded-lg border border-zenith-border bg-zenith-raised/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{product.name}</div>
                <div className="mt-1 text-sm text-zenith-muted">
                  {product.categoryName} · {product.active ? "Active" : "Inactive"}
                  {tab === "menu" ? ` · ${product.sellOnPos ? "On sales menu" : "Not on sales menu"}` : ""}
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
