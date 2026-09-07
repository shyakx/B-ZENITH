"use client";

import { useMemo, useState } from "react";
import { formatStockQty } from "@/lib/domain/units";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Card } from "@/components/ui/Card";

export type MovementReportRow = {
  id: string;
  name: string;
  managerReferenceName: string | null;
  category: string;
  unitCode: string | null;
  onHand: number;
  received: number;
  sold: number;
  returned: number;
  wasted: number;
  adjusted: number;
  transferIn: number;
  transferOut: number;
};

export function InventoryMovementsTable({ rows }: { rows: MovementReportRow[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      rows.filter((row) =>
        matchesSearch(query, row.name, row.managerReferenceName, row.category, row.unitCode),
      ),
    [rows, query],
  );

  return (
    <Card>
      <ListSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by product, nickname, category, or unit…"
      />
      <div className="overflow-x-auto text-sm">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
              <th className="py-2 pr-2" rowSpan={2}>
                Product
              </th>
              <th className="py-2 pr-2" rowSpan={2}>
                Unit
              </th>
              <th className="py-2 pr-2 text-right" rowSpan={2}>
                Current on-hand stock
              </th>
              <th className="py-2 text-center" colSpan={7}>
                Recorded movements
              </th>
            </tr>
            <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
              <th className="py-2 pr-2 text-right">Received</th>
              <th className="py-2 pr-2 text-right">Sold</th>
              <th className="py-2 pr-2 text-right">Returned</th>
              <th className="py-2 pr-2 text-right">Wasted</th>
              <th className="py-2 pr-2 text-right">Adjusted</th>
              <th className="py-2 pr-2 text-right">Transfer in</th>
              <th className="py-2 text-right">Transfer out</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-zenith-muted">
                  {query.trim() ? "No products match that search." : "No movement rows yet."}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const unit = row.unitCode;
                return (
                  <tr key={row.id} className="border-b border-zenith-border/70 align-top">
                    <td className="py-2 pr-2">
                      <div className="font-semibold">{row.name}</div>
                      {row.managerReferenceName ? (
                        <div className="text-xs text-zenith-muted">{row.managerReferenceName}</div>
                      ) : null}
                      <div className="text-xs text-zenith-muted">{row.category}</div>
                    </td>
                    <td className="py-2 pr-2 font-semibold">{unit ?? "—"}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatStockQty(row.onHand, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.received, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.sold, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.returned, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.wasted, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.adjusted, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.transferIn, unit)}</td>
                    <td className="py-2 text-right">{formatStockQty(row.transferOut, unit)}</td>
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
