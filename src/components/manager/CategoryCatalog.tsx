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

  const visible = useMemo(
    () =>
      categories.filter((category) =>
        matchesSearch(
          query,
          category.name,
          categoryAreaStaffLabel(category.area),
          String(category.productCount),
        ),
      ),
    [categories, query],
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

      <ul className="mt-1 grid max-h-[70vh] min-w-0 gap-2 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <li className="rounded-lg border border-zenith-border px-3 py-4 text-sm text-zenith-muted">
            {query.trim() ? "No categories match that search." : "No categories yet."}
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
