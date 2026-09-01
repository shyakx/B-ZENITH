"use client";

import { useState } from "react";
import { ProductType } from "@prisma/client";
import { ProductEditor } from "@/components/manager/ProductForm";

type CatalogItem = {
  id: string;
  name: string;
  categoryName: string;
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
}: {
  items: CatalogItem[];
  categories: { id: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
}) {
  const [tab, setTab] = useState<"menu" | "materials">("menu");
  const menu = items.filter((item) => item.productType !== ProductType.RAW_MATERIAL);
  const materials = items.filter((item) => item.productType === ProductType.RAW_MATERIAL);
  const visible = tab === "menu" ? menu : materials;

  return (
    <div className="mt-5">
      <div className="mb-3 flex gap-2">
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
          Inventory Materials
        </button>
      </div>
      <div className="grid min-w-0 gap-2">
        {visible.map((product) => (
          <article key={product.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{product.name}</div>
                <div className="text-sm">
                  {product.categoryName} · {product.sellingPrice} ·{" "}
                  {product.sellOnPos ? "On POS" : "Not on POS"} · {product.active ? "Active" : "Inactive"}
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
