"use client";

import { useMemo, useState } from "react";
import { BusinessArea } from "@prisma/client";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { CategoryForm, CategoryRow } from "@/components/manager/ProductForm";
import { Button } from "@/components/ui/Button";
import { categoryAreaStaffLabel } from "@/lib/product-type-labels";

export function CategoryCatalog({
  categories,
}: {
  categories: { id: string; name: string; area: BusinessArea; productCount: number }[];
}) {
  const [adding, setAdding] = useState(true);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [productPresence, setProductPresence] = useState("");

  const visible = useMemo(
    () =>
      categories.filter((category) =>
        matchesSearch(
          query,
          category.name,
          categoryAreaStaffLabel(category.area),
          String(category.productCount),
        ) &&
        (!area || category.area === area) &&
        (!productPresence || (category.productCount > 0) === (productPresence === "hasProducts")),
      ),
    [categories, query, area, productPresence],
  );

  return (
    <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zenith-ink">Categories</h2>
        </div>
        <Button type="button" variant="secondary" className="h-10" onClick={() => setAdding((value) => !value)}>
          {adding ? "Hide form" : "+ Add Category"}
        </Button>
      </div>

      {adding ? (
        <div className="mt-3">
          <CategoryForm />
        </div>
      ) : null}

      <div className="mt-4">
        <ListSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search categories…"
          label="Search categories"
          showLabel
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Area</span>
          <select value={area} onChange={(event) => setArea(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">All areas</option>
            {Object.values(BusinessArea).map((value) => (
              <option key={value} value={value}>{categoryAreaStaffLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Products</span>
          <select value={productPresence} onChange={(event) => setProductPresence(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">Any product count</option>
            <option value="hasProducts">Has products</option>
            <option value="empty">No products</option>
          </select>
        </label>
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{visible.length} categories shown.</p>

      <ul className="mt-1 grid max-h-[70vh] min-w-0 gap-2 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <li className="rounded-lg border border-zenith-border px-3 py-4 text-sm text-zenith-muted">
            {query.trim() || area || productPresence ? "No categories match these filters." : "No categories yet."}
          </li>
        ) : null}
        {visible.map((category) => (
          <li key={category.id} className="min-w-0 rounded-lg border border-zenith-border bg-zenith-raised/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{category.name}</div>
                <div className="mt-1 text-sm text-zenith-muted">
                  {categoryAreaStaffLabel(category.area)} · {category.productCount}{" "}
                  {category.productCount === 1 ? "product" : "products"}
                </div>
              </div>
              <CategoryRow category={category} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
