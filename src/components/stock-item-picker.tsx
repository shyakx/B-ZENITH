"use client";

import { useMemo, useState } from "react";
import { formatQuantity } from "@/lib/stock";

export type StockPickerItem = {
  id: string;
  name: string;
  sku?: string;
  categoryName?: string;
  unit?: string;
  available?: number;
};

export function StockItemPicker({
  products,
  value,
  onChange,
}: {
  products: StockPickerItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) =>
      `${item.name} ${item.sku ?? ""} ${item.categoryName ?? ""}`.toLowerCase().includes(q),
    );
  }, [products, query]);

  const groupedProducts = useMemo(() => {
    const groups: Array<{ category: string; items: StockPickerItem[] }> = [];
    const index = new Map<string, number>();
    for (const item of visibleProducts) {
      const category = item.categoryName?.trim() || "Stock";
      const existing = index.get(category);
      if (existing === undefined) {
        index.set(category, groups.length);
        groups.push({ category, items: [item] });
      } else {
        groups[existing]!.items.push(item);
      }
    }
    return groups;
  }, [visibleProducts]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold">
        Choose item
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, SKU, or category..."
          className="mt-1 min-h-11 w-full rounded-md border border-stone-300 px-3 font-medium"
        />
      </label>
      <ul className="max-h-[22rem] overflow-y-auto rounded-lg border border-stone-200">
        {groupedProducts.map((group) => (
          <li key={group.category}>
            <p className="sticky top-0 z-10 bg-stone-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-stone-600">
              {group.category}
            </p>
            <ul className="divide-y">
              {group.items.map((item) => {
                const selected = item.id === value;
                const qty = item.available ?? 0;
                const qtyLabel = item.unit ? formatQuantity(qty, item.unit) : String(qty);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onChange(item.id)}
                      className={`flex min-h-14 w-full flex-col items-start justify-center px-3 py-2 text-left ${
                        selected ? "bg-black text-white" : "bg-white text-stone-950"
                      }`}
                    >
                      <span className="font-black">{item.name}</span>
                      <span className={`text-sm font-medium ${selected ? "text-white/80" : "text-stone-600"}`}>
                        {qtyLabel} available
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {visibleProducts.length === 0 ? (
        <p className="text-sm text-stone-500">No items match this search.</p>
      ) : null}
    </div>
  );
}
