"use client";

import Link from "next/link";
import { useState } from "react";
import { formatStockQty } from "@/lib/domain/units";
import { locationStaffLabel, visibleStockLocations } from "@/lib/domain/locations";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Card } from "@/components/ui/Card";

export type StockWorkbenchRow = {
  id: string;
  name: string;
  categoryName: string;
  main: number;
  bar: number;
  kitchen: number;
  cafe: number;
  total: number;
  unitCode: string | null;
  canReceive: boolean;
  canTransfer: boolean;
  defaultLocationCode?: string | null;
  managerReferenceName?: string | null;
};

function moveHref(kind: string, productId: string) {
  return `/manager/inventory?kind=${kind}&productId=${encodeURIComponent(productId)}`;
}

export function StockWorkbench({ rows }: { rows: StockWorkbenchRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [stockLevel, setStockLevel] = useState("");
  const categories = [...new Set(rows.map((row) => row.categoryName))].sort((a, b) => a.localeCompare(b));
  const visible = rows.filter((row) => {
        const quantityByLocation: Record<string, number> = {
          MAIN: row.main,
          BAR: row.bar,
          KITCHEN: row.kitchen,
          CAFE: row.cafe,
        };
        const stockToCheck = location ? quantityByLocation[location] ?? 0 : row.total;
        const matchesLevel =
          !stockLevel ||
          (stockLevel === "zero" && stockToCheck === 0) ||
          (stockLevel === "low" && stockToCheck > 0 && stockToCheck <= 5) ||
          (stockLevel === "available" && stockToCheck > 5);
        return (
          matchesSearch(
            query,
            row.name,
            row.categoryName,
            row.unitCode,
            row.managerReferenceName,
            row.defaultLocationCode,
            row.defaultLocationCode ? locationStaffLabel(row.defaultLocationCode) : null,
          ) &&
          (!category || row.categoryName === category) &&
          (!location || Boolean(stockLevel) || stockToCheck > 0) &&
          matchesLevel
        );
      });

  return (
    <Card>
      <div className="mb-3">
        <h2 className="font-semibold">Stock by location</h2>
      </div>
      <ListSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search product, category, or location…"
        label="Search stock"
        showLabel
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-w-40 rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          >
            <option value="">All categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="min-w-40 rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          >
            <option value="">All locations</option>
            <option value="MAIN">Main</option>
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
            <option value="CAFE">Cafe</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Stock level</span>
          <select
            value={stockLevel}
            onChange={(event) => setStockLevel(event.target.value)}
            className="min-w-40 rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          >
            <option value="">All levels</option>
            <option value="zero">Out of stock</option>
            <option value="low">Low (1-5)</option>
            <option value="available">Available (&gt;5)</option>
          </select>
        </label>
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{visible.length} products shown.</p>
      <div className="overflow-x-auto text-sm">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
              <th className="border-r border-zenith-border px-3 py-2">Product</th>
              <th className="border-r border-zenith-border px-3 py-2">Unit</th>
              <th className="border-r border-zenith-border px-3 py-2">Locations</th>
              <th className="border-r border-zenith-border px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-zenith-muted">
                  {query.trim() || category || location || stockLevel
                    ? "No products match these filters."
                    : "No tracked stock products yet."}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const unit = row.unitCode;
                const locations = visibleStockLocations(row);
                const usedAt =
                  row.defaultLocationCode && row.defaultLocationCode !== "MAIN"
                    ? locationStaffLabel(row.defaultLocationCode)
                    : null;
                return (
                  <tr key={row.id} className="border-b border-zenith-border align-top">
                    <td className="border-r border-zenith-border px-3 py-2.5">
                      <div className="font-semibold">{row.name}</div>
                      {row.managerReferenceName ? (
                        <div className="text-xs text-zenith-muted">{row.managerReferenceName}</div>
                      ) : null}
                      <div className="text-xs text-zenith-muted">
                        {row.categoryName}
                        {usedAt ? ` · Used from ${usedAt}` : ""}
                      </div>
                    </td>
                    <td className="border-r border-zenith-border px-3 py-2.5 font-semibold">
                      {unit ?? "—"}
                    </td>
                    <td className="border-r border-zenith-border px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {locations.map((location) => (
                          <div key={location.code} className="flex flex-wrap justify-between gap-3">
                            <span className="text-zenith-muted">{location.label}</span>
                            <span className="font-semibold">
                              {formatStockQty(location.quantity, unit)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="border-r border-zenith-border px-3 py-2.5 text-right font-semibold">
                      {formatStockQty(row.total, unit)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {row.canReceive ? (
                          <Link
                            href={moveHref("receive", row.id)}
                            className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                          >
                            Receive
                          </Link>
                        ) : null}
                        {row.canTransfer ? (
                          <Link
                            href={moveHref("transfer", row.id)}
                            className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                          >
                            Transfer
                          </Link>
                        ) : null}
                        <Link
                          href={moveHref("count", row.id)}
                          className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                        >
                          Count
                        </Link>
                        <Link
                          href={moveHref("adjust", row.id)}
                          className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                        >
                          Adjust
                        </Link>
                        <Link
                          href={moveHref("waste", row.id)}
                          className="rounded-md border border-zenith-danger/40 px-2 py-1 text-xs font-semibold text-zenith-danger"
                        >
                          Waste
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
