"use client";

import { useMemo, useState } from "react";
import { formatStockQty } from "@/lib/domain/units";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Card } from "@/components/ui/Card";

export type InventoryStockRow = {
  id: string;
  name: string;
  main: number;
  bar: number;
  kitchen: number;
  cafe: number;
  managerReferenceName?: string | null;
  baseUnit?: { code: string; name: string } | null;
};

function StockTable({ title, rows }: { title: string; rows: InventoryStockRow[] }) {
  return (
    <Card className="mb-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zenith-muted">Nothing in this list yet.</p>
      ) : (
        <div className="overflow-x-auto text-sm">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Unit</th>
                <th className="py-2 pr-2 text-right">Main</th>
                <th className="py-2 pr-2 text-right">Bar</th>
                <th className="py-2 pr-2 text-right">Kitchen</th>
                <th className="py-2 text-right">Cafe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const unit = product.baseUnit?.code ?? null;
                return (
                  <tr key={product.id} className="border-b border-zenith-border/70">
                    <td className="py-2 pr-2 font-semibold">
                      {product.name}
                      {product.managerReferenceName ? (
                        <div className="font-normal text-xs text-zenith-muted">{product.managerReferenceName}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-xs font-semibold text-zenith-muted">{unit ?? "—"}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(product.main, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(product.bar, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(product.kitchen, unit)}</td>
                    <td className="py-2 text-right">{formatStockQty(product.cafe, unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function InventoryStockLists({
  materials,
  packaged,
}: {
  materials: InventoryStockRow[];
  packaged: InventoryStockRow[];
}) {
  const [query, setQuery] = useState("");
  const filteredMaterials = useMemo(
    () =>
      materials.filter((row) =>
        matchesSearch(query, row.name, row.managerReferenceName, row.baseUnit?.code, row.baseUnit?.name),
      ),
    [materials, query],
  );
  const filteredPackaged = useMemo(
    () =>
      packaged.filter((row) =>
        matchesSearch(query, row.name, row.managerReferenceName, row.baseUnit?.code, row.baseUnit?.name),
      ),
    [packaged, query],
  );

  return (
    <div>
      <ListSearchField value={query} onChange={setQuery} placeholder="Search stock by product, nickname, or unit…" />
      {query.trim() && filteredMaterials.length === 0 && filteredPackaged.length === 0 ? (
        <p className="mb-4 text-sm text-zenith-muted">No stock rows match that search.</p>
      ) : null}
      <StockTable title="Stock items" rows={filteredMaterials} />
      <StockTable title="Menu and bottled / packaged" rows={filteredPackaged} />
    </div>
  );
}
