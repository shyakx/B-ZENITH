"use client";

import { Fragment, useMemo, useState } from "react";
import { locationLabel, overviewStatus } from "@/lib/inventory-totals";

export type OverviewMovement = {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  locationCode: string | null;
  counterpartLocationCode: string | null;
  performedBy: string;
  note: string | null;
  reason: string | null;
  referenceId: string | null;
};

export type OverviewItem = {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  unit: string;
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
  lastMain: OverviewMovement | null;
  lastBar: OverviewMovement | null;
  lastKitchen: OverviewMovement | null;
  recent: OverviewMovement[];
};

type LocationFilter = "ALL" | "MAIN_STOCK" | "BAR" | "KITCHEN";
type StatusFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

function statusLabel(status: ReturnType<typeof overviewStatus>) {
  if (status === "OUT_OF_STOCK") return "Out of Stock";
  if (status === "LOW_STOCK") return "Low Stock";
  return "In Stock";
}

function statusClass(status: ReturnType<typeof overviewStatus>) {
  if (status === "OUT_OF_STOCK") return "bg-stone-800 text-white";
  if (status === "LOW_STOCK") return "bg-amber-500 text-black";
  return "bg-emerald-700 text-white";
}

function qtyAt(item: OverviewItem, filter: LocationFilter) {
  if (filter === "MAIN_STOCK") return item.main;
  if (filter === "BAR") return item.bar;
  if (filter === "KITCHEN") return item.kitchen;
  return item.total;
}

function movementTitle(type: string) {
  if (type === "PURCHASE") return "Received";
  if (type === "SALE") return "Sold";
  if (type === "WASTE") return "Waste";
  if (type === "TRANSFER_OUT") return "Transfer out";
  if (type === "TRANSFER_IN") return "Transfer in";
  if (type === "STOCK_TAKE") return "Stock count";
  if (type === "ADJUSTMENT") return "Adjustment";
  if (type === "RETURN") return "Return";
  return type;
}

export function InventoryOverview({ items }: { items: OverviewItem[] }) {
  const [location, setLocation] = useState<LocationFilter>("ALL");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.categoryName))).sort(), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "ALL" && item.categoryName !== category) return false;
      if (location !== "ALL" && qtyAt(item, location) <= 0) return false;
      const qty = qtyAt(item, location);
      const rowStatus = overviewStatus(qty, item.reorderLevel);
      if (status !== "ALL" && rowStatus !== status) return false;
      if (!q) return true;
      return `${item.name} ${item.sku}`.toLowerCase().includes(q);
    });
  }, [category, items, location, query, status]);

  const cards = useMemo(() => {
    const source = items;
    return {
      products: source.length,
      main: source.filter((item) => item.main > 0).length,
      bar: source.filter((item) => item.bar > 0).length,
      kitchen: source.filter((item) => item.kitchen > 0).length,
      low: source.filter((item) => overviewStatus(item.total, item.reorderLevel) === "LOW_STOCK").length,
      out: source.filter((item) => overviewStatus(item.total, item.reorderLevel) === "OUT_OF_STOCK").length,
    };
  }, [items]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total products", String(cards.products)],
          ["MAIN STOCK", String(cards.main)],
          ["BAR", String(cards.bar)],
          ["KITCHEN", String(cards.kitchen)],
          ["Low stock", String(cards.low)],
          ["Out of stock", String(cards.out)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-stone-300 bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-stone-600">{label}</p>
            <p className="mt-1 text-2xl font-black text-stone-950">{value}</p>
            <p className="mt-1 text-[11px] text-stone-500">Product count</p>
          </article>
        ))}
      </section>
      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or SKU"
          className="min-h-11 min-w-56 flex-1 rounded-md border border-stone-300 bg-white px-3"
        />
        <select value={location} onChange={(event) => setLocation(event.target.value as LocationFilter)} className="min-h-11 rounded-md border border-stone-300 bg-white px-3">
          <option value="ALL">All locations</option>
          <option value="MAIN_STOCK">MAIN STOCK</option>
          <option value="BAR">BAR</option>
          <option value="KITCHEN">KITCHEN</option>
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-md border border-stone-300 bg-white px-3">
          <option value="ALL">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="min-h-11 rounded-md border border-stone-300 bg-white px-3">
          <option value="ALL">All statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
      </div>

      <div className="space-y-3 lg:hidden">
        {visible.map((item) => {
          const qty = qtyAt(item, location);
          const rowStatus = overviewStatus(qty, item.reorderLevel);
          const open = openId === item.id;
          return (
            <article key={item.id} className="rounded-lg border border-stone-300 bg-white p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(open ? null : item.id)}>
                <p className="font-black">{item.name}</p>
                <p className="text-xs text-stone-500">{item.sku} · {item.unit}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold">{item.categoryName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-black ${statusClass(rowStatus)}`}>{statusLabel(rowStatus)}</span>
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-widest text-stone-500">Total available</p>
                <p className="text-2xl font-black">{item.total}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-black p-2 text-white"><p className="text-[10px] font-black">MAIN STOCK</p><p className="text-lg font-black text-[#d4af37]">{item.main}</p></div>
                  <div className="rounded-md bg-sky-900 p-2 text-white"><p className="text-[10px] font-black">BAR</p><p className="text-lg font-black">{item.bar}</p></div>
                  <div className="rounded-md bg-amber-800 p-2 text-white"><p className="text-[10px] font-black">KITCHEN</p><p className="text-lg font-black">{item.kitchen}</p></div>
                </div>
              </button>
              {open ? <ExpandedDetails item={item} /> : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-stone-300 bg-white lg:block">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-stone-950 text-white">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">MAIN STOCK</th>
              <th className="p-3">BAR</th>
              <th className="p-3">KITCHEN</th>
              <th className="p-3">Total available</th>
              <th className="p-3">Received</th>
              <th className="p-3">Sold</th>
              <th className="p-3">Wasted</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const qty = qtyAt(item, location);
              const rowStatus = overviewStatus(qty, item.reorderLevel);
              const open = openId === item.id;
              return (
                <Fragment key={item.id}>
                  <tr className="border-t border-stone-200">
                    <td className="p-3">
                      <p className="font-black">{item.name}</p>
                      <p className="text-xs text-stone-500">{item.sku} · {item.unit}</p>
                    </td>
                    <td className="p-3"><span className="rounded-full bg-stone-200 px-2 py-1 text-xs font-bold">{item.categoryName}</span></td>
                    <td className={`p-3 font-bold ${location === "MAIN_STOCK" ? "text-[#947313]" : ""}`}>{item.main}</td>
                    <td className={`p-3 font-bold ${location === "BAR" ? "text-sky-800" : ""}`}>{item.bar}</td>
                    <td className={`p-3 font-bold ${location === "KITCHEN" ? "text-amber-800" : ""}`}>{item.kitchen}</td>
                    <td className="p-3 text-base font-black">{item.total}</td>
                    <td className="p-3">{item.supplied}</td>
                    <td className="p-3">{item.sold}</td>
                    <td className="p-3">{item.wasted}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass(rowStatus)}`}>{statusLabel(rowStatus)}</span></td>
                    <td className="p-3">
                      <button type="button" className="min-h-10 rounded-md border border-stone-400 px-3 text-xs font-bold" onClick={() => setOpenId(open ? null : item.id)}>
                        {open ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${item.id}-open`} className="bg-stone-50">
                      <td colSpan={11} className="p-4">
                        <ExpandedDetails item={item} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? <p className="p-8 text-center text-stone-500">No products match these filters.</p> : null}
    </div>
  );
}

function ExpandedDetails({ item }: { item: OverviewItem }) {
  const transfers = item.recent.filter((move) => move.type === "TRANSFER_OUT" || move.type === "TRANSFER_IN");
  const waste = item.recent.filter((move) => move.type === "WASTE");
  const counts = item.recent.filter((move) => move.type === "STOCK_TAKE");

  return (
    <div className="mt-4 space-y-5 lg:mt-0">
      <div className="grid gap-4 lg:grid-cols-3">
        <LocationCard title="MAIN STOCK" quantity={item.main} last={item.lastMain} tone="black" />
        <LocationCard title="BAR" quantity={item.bar} last={item.lastBar} tone="bar" />
        <LocationCard title="KITCHEN" quantity={item.kitchen} last={item.lastKitchen} tone="kitchen" />
      </div>
      <p className="text-sm text-stone-600">Received {item.supplied} · Sold {item.sold} · Wasted {item.wasted} · Returned {item.returned}</p>
      <HistoryTable title="Movement history" rows={item.recent} />
      <HistoryTable title="Transfer history" rows={transfers} />
      <HistoryTable title="Waste history" rows={waste} />
      <HistoryTable title="Stock count history" rows={counts} />
    </div>
  );
}

function LocationCard({
  title,
  quantity,
  last,
  tone,
}: {
  title: string;
  quantity: number;
  last: OverviewMovement | null;
  tone: "black" | "bar" | "kitchen";
}) {
  const cls = tone === "black" ? "bg-black text-white" : tone === "bar" ? "bg-sky-900 text-white" : "bg-amber-800 text-white";
  return (
    <div className={`rounded-lg p-4 ${cls}`}>
      <p className="text-[10px] font-black uppercase tracking-widest">{title}</p>
      <p className="mt-1 text-3xl font-black">{quantity}</p>
      <p className="mt-2 text-xs opacity-90">
        {last
          ? `Last: ${movementTitle(last.type)} ${last.quantity > 0 ? "+" : ""}${last.quantity} · ${new Date(last.createdAt).toLocaleString("en-RW")}`
          : "No movement at this location yet"}
      </p>
    </div>
  );
}

function HistoryTable({ title, rows }: { title: string; rows: OverviewMovement[] }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-stone-600">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">None in recent history.</p>
      ) : (
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              <th className="py-1">Date</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Location</th>
              <th>Reason</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((move) => (
              <tr key={move.id} className="border-t">
                <td className="py-1">{new Date(move.createdAt).toLocaleString("en-RW")}</td>
                <td>
                  {movementTitle(move.type)}
                  {move.type === "TRANSFER_OUT" && move.counterpartLocationCode
                    ? ` · ${locationLabel(move.locationCode ?? "")} → ${locationLabel(move.counterpartLocationCode)}`
                    : ""}
                  {move.type === "TRANSFER_IN" && move.counterpartLocationCode
                    ? ` · ${locationLabel(move.counterpartLocationCode)} → ${locationLabel(move.locationCode ?? "")}`
                    : ""}
                </td>
                <td>{move.quantity > 0 ? "+" : ""}{move.quantity}</td>
                <td>{move.locationCode ? locationLabel(move.locationCode) : "—"}</td>
                <td>{move.reason || move.note || "—"}</td>
                <td>{move.referenceId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
