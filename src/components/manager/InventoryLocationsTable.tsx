"use client";

import { useMemo, useState } from "react";
import { ProductType } from "@prisma/client";
import { formatRwf } from "@/lib/domain/money";
import { formatStockQty } from "@/lib/domain/units";
import { productTypeStaffLabel } from "@/lib/product-type-labels";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Card } from "@/components/ui/Card";

type StockRow = {
  id: string;
  name: string;
  productType: ProductType;
  main: number;
  bar: number;
  kitchen: number;
  cafe: number;
  total: number;
  valuation: number;
  managerReferenceName?: string | null;
  baseUnit?: { code: string; name: string } | null;
};

export function InventoryLocationsTable({ stock }: { stock: StockRow[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      stock.filter((product) =>
        matchesSearch(
          query,
          product.name,
          product.managerReferenceName,
          product.baseUnit?.code,
          productTypeStaffLabel(product.productType),
        ),
      ),
    [stock, query],
  );

  return (
    <Card>
      <ListSearchField value={query} onChange={setQuery} placeholder="Search by product, nickname, or unit…" />
      <div className="overflow-x-auto text-sm">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Unit</th>
              <th className="py-2 pr-2">Main</th>
              <th className="py-2 pr-2">Bar</th>
              <th className="py-2 pr-2">Kitchen</th>
              <th className="py-2 pr-2">Cafe</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-zenith-muted">
                  {query.trim() ? "No products match that search." : "No stock yet."}
                </td>
              </tr>
            ) : (
              rows.map((product) => {
                const unit = product.baseUnit?.code ?? null;
                return (
                  <tr key={product.id} className="border-b border-zenith-border/70">
                    <td className="py-2 pr-2 font-semibold">
                      {product.name}
                      {product.managerReferenceName ? (
                        <div className="font-normal text-xs text-zenith-muted">{product.managerReferenceName}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">{productTypeStaffLabel(product.productType)}</td>
                    <td className="py-2 pr-2 font-semibold">{unit ?? "—"}</td>
                    <td className="py-2 pr-2">{formatStockQty(product.main, unit)}</td>
                    <td className="py-2 pr-2">{formatStockQty(product.bar, unit)}</td>
                    <td className="py-2 pr-2">{formatStockQty(product.kitchen, unit)}</td>
                    <td className="py-2 pr-2">{formatStockQty(product.cafe, unit)}</td>
                    <td className="py-2 pr-2 font-semibold">{formatStockQty(product.total, unit)}</td>
                    <td className="py-2">{formatRwf(product.valuation)}</td>
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
