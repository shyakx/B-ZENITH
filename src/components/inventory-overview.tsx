"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/datetime";
import { locationLabel, stockStatus } from "@/lib/inventory-totals";

export type OverviewMovement = {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  locationCode: string | null;
  performedBy: string;
  note: string | null;
  reason: string | null;
};

export type OverviewItem = {
  id: string;
  name: string;
  categoryName: string;
  unit: string;
  costPrice: number;
  reorderLevel: number;
  main: number;
  bar: number;
  kitchen: number;
  total: number;
  supplied: number;
  wasted: number;
  sold: number;
  returned: number;
  transferredOut: number;
  transferredIn: number;
  adjustments: number;
  lastMovementAt: string | null;
  lastMovementType: string | null;
  recent: OverviewMovement[];
};

type Filter = "ALL" | "MAIN_STOCK" | "BAR" | "KITCHEN";

function statusClass(status: string) {
  if (status === "NEGATIVE") return "bg-red-100 text-red-800";
  if (status === "ZERO") return "bg-stone-200 text-stone-800";
  if (status === "LOW") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function qtyFor(item: OverviewItem, filter: Filter) {
  if (filter === "MAIN_STOCK") return item.main;
  if (filter === "BAR") return item.bar;
  if (filter === "KITCHEN") return item.kitchen;
  return item.total;
}

export function InventoryOverview({ items, currency }: { items: OverviewItem[]; currency: string }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.categoryName))).sort(), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "ALL" && item.categoryName !== category) return false;
      return !q || `${item.name} ${item.categoryName}`.toLowerCase().includes(q);
    });
  }, [category, items, query]);

  const totals = visible.reduce(
    (acc, item) => {
      const qty = qtyFor(item, filter);
      acc.units += qty;
      acc.value += qty * item.costPrice;
      acc.wasted += item.wasted;
      if (qty < 0) acc.negative += 1;
      else if (qty === 0) acc.zero += 1;
      else if (qty <= item.reorderLevel) acc.low += 1;
      return acc;
    },
    { units: 0, value: 0, wasted: 0, low: 0, zero: 0, negative: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["ALL", "MAIN_STOCK", "BAR", "KITCHEN"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setFilter(code)}
            className={`min-h-11 rounded-md px-4 text-sm font-bold ${
              filter === code
                ? code === "BAR"
                  ? "bg-sky-800 text-white"
                  : code === "KITCHEN"
                    ? "bg-amber-800 text-white"
                    : "bg-black text-[#d4af37]"
                : "border bg-white"
            }`}
          >
            {code === "ALL" ? "All locations" : locationLabel(code)}
          </button>
        ))}
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Products", String(visible.length)],
          ["Units", String(totals.units)],
          ["Low stock", String(totals.low)],
          ["Zero stock", String(totals.zero)],
          ["Negative", String(totals.negative)],
          ["Value", formatMoney(totals.value, currency)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</p>
            <p className={`mt-1 text-2xl font-black ${label === "Negative" && totals.negative > 0 ? "text-red-700" : ""}`}>{value}</p>
          </article>
        ))}
      </section>
      <p className="text-sm text-stone-500">Wasted / broken from the movement ledger: {totals.wasted} units.</p>
      <div className="flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="min-h-11 min-w-56 flex-1 rounded-md border px-3" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-md border px-3">
          <option value="ALL">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Main Stock</th>
              <th className="p-3">Bar</th>
              <th className="p-3">Kitchen</th>
              <th className="p-3">Total available</th>
              <th className="p-3">Received</th>
              <th className="p-3">Sold</th>
              <th className="p-3">Wasted / broken</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const qty = qtyFor(item, filter);
              const status = stockStatus(qty, item.reorderLevel);
              const open = openId === item.id;
              return (
                <tr key={`${item.id}-${open ? "open" : "closed"}`} className="contents">
                  <td colSpan={10} className="p-0">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <tbody>
                        <tr className={`cursor-pointer ${qty < 0 ? "bg-red-50" : ""}`} onClick={() => setOpenId(open ? null : item.id)}>
                          <td className="p-3 font-bold">{item.name}</td>
                          <td className="p-3">{item.categoryName}</td>
                          <td className={`p-3 ${filter === "MAIN_STOCK" ? "font-black" : ""}`}>{item.main}</td>
                          <td className={`p-3 ${filter === "BAR" ? "font-black" : ""}`}>{item.bar}</td>
                          <td className={`p-3 ${filter === "KITCHEN" ? "font-black" : ""}`}>{item.kitchen}</td>
                          <td className="p-3 font-bold">{item.total}</td>
                          <td className="p-3">{item.supplied}</td>
                          <td className="p-3">{item.sold}</td>
                          <td className="p-3">{item.wasted}</td>
                          <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span></td>
                        </tr>
                        {open ? (
                          <tr className="bg-stone-50">
                            <td colSpan={10} className="p-4">
                              <div className="grid gap-4 lg:grid-cols-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Product summary</p>
                                  <p className="mt-1 font-black">{item.name}</p>
                                  <p className="text-sm text-stone-600">Category: {item.categoryName} · {item.unit}</p>
                                  <p className="text-sm">Unit cost {formatMoney(item.costPrice, currency)}</p>
                                  <p className="text-sm">Stock value {formatMoney(item.total * item.costPrice, currency)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Location balances</p>
                                  <ul className="mt-1 space-y-1 text-sm">
                                    <li>Main Stock: {item.main}</li>
                                    <li>Bar: {item.bar}</li>
                                    <li>Kitchen: {item.kitchen}</li>
                                    <li className="font-bold">Total: {item.total}</li>
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Movement summary</p>
                                  <ul className="mt-1 space-y-1 text-sm">
                                    <li>Received: {item.supplied}</li>
                                    <li>Transferred Main → other: {item.transferredOut}</li>
                                    <li>Received by transfer: {item.transferredIn}</li>
                                    <li>Sold: {item.sold}</li>
                                    <li>Returned: {item.returned}</li>
                                    <li>Wasted: {item.wasted}</li>
                                    <li>Adjustments: {item.adjustments}</li>
                                  </ul>
                                </div>
                              </div>
                              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-stone-500">Recent activity</p>
                              {item.recent.length === 0 ? (
                                <p className="mt-2 text-sm text-stone-500">No movements yet.</p>
                              ) : (
                                <table className="mt-2 w-full text-left text-xs">
                                  <thead>
                                    <tr>
                                      <th className="py-1">Date</th>
                                      <th>Action</th>
                                      <th>Location</th>
                                      <th>Qty</th>
                                      <th>Balance</th>
                                      <th>By</th>
                                      <th>Note</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.recent.map((move) => (
                                      <tr key={move.id} className="border-t">
                                        <td className="py-1">{new Date(move.createdAt).toLocaleString("en-RW")}</td>
                                        <td>{move.type}</td>
                                        <td>{move.locationCode ? locationLabel(move.locationCode) : "—"}</td>
                                        <td className={move.quantity < 0 ? "text-red-700" : "text-green-700"}>
                                          {move.quantity > 0 ? "+" : ""}{move.quantity}
                                        </td>
                                        <td>{move.balanceAfter}</td>
                                        <td>{move.performedBy}</td>
                                        <td>{move.reason || move.note || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="p-8 text-center text-stone-500">No products match this filter.</p> : null}
      </div>
    </div>
  );
}
