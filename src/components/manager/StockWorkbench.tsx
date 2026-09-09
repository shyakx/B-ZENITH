"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatStockQty, isPourUnit } from "@/lib/domain/units";
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
  defaultLocationCode?: string | null;
  managerReferenceName?: string | null;
};

function moveHref(kind: string, productId: string) {
  return `/manager/inventory?kind=${kind}&productId=${encodeURIComponent(productId)}`;
}

export function StockWorkbench({ rows }: { rows: StockWorkbenchRow[] }) {
  const [query, setQuery] = useState("");
  const tangible = useMemo(
    () => rows.filter((row) => !isPourUnit(row.unitCode ?? "")),
    [rows],
  );
  const visible = useMemo(
    () =>
      tangible.filter((row) =>
        matchesSearch(
          query,
          row.name,
          row.categoryName,
          row.unitCode,
          row.managerReferenceName,
          row.defaultLocationCode,
          row.defaultLocationCode ? locationStaffLabel(row.defaultLocationCode) : null,
        ),
      ),
    [tangible, query],
  );

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
                  {query.trim() ? "No products match that search." : "No tangible stock products yet."}
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
                        <Link
                          href={moveHref("receive", row.id)}
                          className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                        >
                          Receive
                        </Link>
                        <Link
                          href={moveHref("transfer", row.id)}
                          className="rounded-md border border-zenith-border px-2 py-1 text-xs font-semibold"
                        >
                          Move
                        </Link>
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
