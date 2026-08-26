"use client";

import { useMemo, useState } from "react";
import type { ProductUnit } from "@prisma/client";
import { InventoryOperationDialog } from "@/components/inventory-operation-dialog";
import { PurchaseForm } from "@/components/purchase-form";
import { StockTakeForm } from "@/components/stock-take-form";
import { StockTransferForm } from "@/components/stock-transfer-form";
import { WasteForm } from "@/components/waste-form";
import { locationLabel, overviewStatus } from "@/lib/inventory-totals";
import {
  formatQuantity,
  isPhysicalStockProduct,
  isStockPageProduct,
  matchesCatalogKind,
  matchesStockType,
  type CatalogKindFilter,
  type StockTypeFilter,
} from "@/lib/stock";
import { DashboardHeader } from "@/components/dashboard/ui";

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
  seedKey?: string | null;
  unit: ProductUnit;
  costPrice: number;
  trackInventory: boolean;
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

export type InventoryActivity = {
  id: string;
  createdAt: string;
  productName: string;
  type: string;
  quantity: number;
  balanceAfter?: number;
  locationCode: string | null;
  performedBy: string;
  referenceId: string | null;
};

type LocationFilter ="ALL" |"MAIN_STOCK" |"BAR" |"KITCHEN";
type StatusFilter ="ALL" |"IN_STOCK" |"LOW_STOCK" |"OUT_OF_STOCK";
type OpKind ="add" |"take" |"transfer" |"waste" | null;

function statusCopy(status: ReturnType<typeof overviewStatus>, qty: number, unit: string) {
  if (status === "OUT_OF_STOCK") return { label: "Out of stock", className: "bg-black text-white" };
  if (status === "LOW_STOCK") return { label: `Running low · ${formatQuantity(qty, unit)}`, className: "bg-[#FFD758] text-black" };
  return { label: "In stock", className: "border border-black bg-white text-black" };
}

function qtyAt(item: OverviewItem, filter: LocationFilter) {
  if (filter ==="MAIN_STOCK") return item.main;
  if (filter ==="BAR") return item.bar;
  if (filter ==="KITCHEN") return item.kitchen;
  return item.total;
}

function whereLine(item: OverviewItem, filter: LocationFilter) {
  if (filter !=="ALL") return locationLabel(filter);
  return `Main Store ${item.main} · Bar ${item.bar} · Kitchen ${item.kitchen}`;
}

function activitySentence(row: InventoryActivity) {
  const qty = Math.abs(row.quantity);
  const place = row.locationCode ? locationLabel(row.locationCode) :"";
  if (row.type ==="PURCHASE") return `Added ${qty} ${row.productName}${place ? ` to ${place}` :""}`;
  if (row.type ==="TRANSFER_IN") return `Moved ${qty} ${row.productName} to ${place ||"another place"}`;
  if (row.type ==="TRANSFER_OUT") return `Moved ${qty} ${row.productName} from ${place ||"a place"}`;
  if (row.type ==="STOCK_TAKE") {
    return row.balanceAfter != null
      ? `Count updated: ${row.productName} is now ${row.balanceAfter}`
      : `Count updated for ${row.productName}`;
  }
  if (row.type ==="WASTE") return `Recorded ${qty} ${row.productName} as waste`;
  if (row.type ==="ADJUSTMENT") return `Stock count for ${row.productName} was corrected`;
  if (row.type ==="SALE" || row.type ==="SESSION_POST") return `Sold ${qty} ${row.productName}`;
  if (row.type ==="RETURN" || row.type ==="ORDER_VOID") return `Returned ${qty} ${row.productName}`;
  return `${row.productName}`;
}

const LOCATION_HINT: Record<LocationFilter, string> = {
  ALL:"What we have, and where it is.",
  MAIN_STOCK:"Showing what is currently in Main Store.",
  BAR:"Showing what is currently at the Bar.",
  KITCHEN:"Showing what is currently in the Kitchen.",
};

const TYPE_OPTIONS: Array<[StockTypeFilter, string]> = [
  ["ALL","All types"],
  ["KITCHEN","Kitchen stock"],
  ["BAR","Bar stock"],
  ["CAFE","Café stock"],
  ["PACKAGING","Packaging"],
  ["INGREDIENTS","Ingredients"],
  ["DRINKS","Drinks"],
];

export function InventoryOverview({
  items,
  activity,
  canManage,
}: {
  items: OverviewItem[];
  activity: InventoryActivity[];
  recentMovementCount: number;
  canManage: boolean;
}) {
  const [location, setLocation] = useState<LocationFilter>("ALL");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CatalogKindFilter>("STOCK");
  const [stockType, setStockType] = useState<StockTypeFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [op, setOp] = useState<OpKind>(null);
  const [opProductId, setOpProductId] = useState<string | undefined>();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!isStockPageProduct(item)) return false;
      if (!matchesCatalogKind(item, kind)) return false;
      if (!matchesStockType(item.categoryName, stockType)) return false;
      const qty = qtyAt(item, location);
      const rowStatus = overviewStatus(qty, item.reorderLevel);
      if (status !=="ALL" && rowStatus !== status) return false;
      if (!q) return true;
      return `${item.name} ${item.sku} ${item.categoryName}`.toLowerCase().includes(q);
    });
  }, [items, kind, location, query, status, stockType]);

  const summary = useMemo(() => {
    const source = visible;
    return {
      products: source.length,
      units: source.reduce((sum, item) => sum + qtyAt(item, location), 0),
      low: source.filter((item) => overviewStatus(qtyAt(item, location), item.reorderLevel) ==="LOW_STOCK").length,
      out: source.filter((item) => overviewStatus(qtyAt(item, location), item.reorderLevel) ==="OUT_OF_STOCK").length,
    };
  }, [location, visible]);

  const selected = items.find((item) => item.id === openId) ?? null;
  const physicalItems = items.filter(isPhysicalStockProduct);
  const transferProducts = physicalItems.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    categoryName: item.categoryName,
    unit: item.unit,
    mainQuantity: item.main,
    barQuantity: item.bar,
    kitchenQuantity: item.kitchen,
  }));
  const wasteProducts = physicalItems.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    categoryName: item.categoryName,
    unit: item.unit,
    quantities: { MAIN_STOCK: item.main, BAR: item.bar, KITCHEN: item.kitchen },
  }));
  const takeProducts = physicalItems.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    categoryName: item.categoryName,
    stockQuantity: item.total,
    unit: item.unit,
    locationQuantities: { MAIN_STOCK: item.main, BAR: item.bar, KITCHEN: item.kitchen },
  }));
  const purchaseProducts = physicalItems.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    categoryName: item.categoryName,
    unit: item.unit,
    available: item.total,
  }));

  function openOp(kind: OpKind, productId?: string) {
    setOpProductId(productId);
    setOp(kind);
  }

  return (
    <div className="space-y-5">
      <DashboardHeader
        title="Stock"
        subtitle="Monitor and manage physical inventory across your locations."
        actions={
          canManage ? (
            <button type="button" onClick={() => openOp("add")} className="bz-btn-primary">
              + Add Stock
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([
          ["ALL","All"],
          ["MAIN_STOCK","Main Store"],
          ["BAR","Bar"],
          ["KITCHEN","Kitchen"],
        ] as const).map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocation(code)}
            className={`min-h-14 rounded-md border px-3 py-2.5 text-left ${
              location === code ? "border-black bg-[#FFD758] text-black" : "border-black bg-white text-black"
            }`}
          >
            <p className="bz-label">{label}</p>
            <p className="mt-1 text-sm font-medium">{location === code ?"Showing now" :"View"}</p>
          </button>
        ))}
      </div>
      <p className="text-sm font-medium text-black">{LOCATION_HINT[location]}</p>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Items", String(summary.products)],
          ["Available", String(summary.units)],
          ["Running low", String(summary.low)],
          ["Out of stock", String(summary.out)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-md border border-black bg-white px-3 py-3">
            <p className="bz-label">{label}</p>
            <p className="bz-kpi">{value}</p>
          </article>
        ))}
      </section>

      {canManage ? (
        <section className="rounded-md border border-black bg-white p-4">
          <h2 className="bz-section-title">What do you want to do?</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <button type="button" onClick={() => openOp("add")} className="min-h-[4.5rem] rounded-md bg-[#FFD758] px-4 py-3 text-left">
              <p className="text-sm font-medium text-black">+ Add stock</p>
              <p className="mt-1 text-sm font-normal text-black">Something arrived?</p>
            </button>
            <button type="button" onClick={() => openOp("transfer")} className="min-h-[4.5rem] rounded-md border border-black bg-white px-4 py-3 text-left">
              <p className="text-sm font-medium">Move stock</p>
              <p className="mt-1 text-sm font-normal text-black">Move something to another place.</p>
            </button>
            <button type="button" onClick={() => openOp("take")} className="min-h-[4.5rem] rounded-md border border-black bg-white px-4 py-3 text-left">
              <p className="text-sm font-medium">Count stock</p>
              <p className="mt-1 text-sm font-normal text-black">Count what you actually have.</p>
            </button>
            <button type="button" onClick={() => openOp("waste")} className="min-h-[4.5rem] rounded-md border border-black bg-white px-4 py-3 text-left">
              <p className="text-sm font-medium">Record waste</p>
              <p className="mt-1 text-sm font-normal text-black">Damaged, expired, or thrown away?</p>
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-black bg-white px-4 py-3 text-sm font-medium text-black">
          You can see what is available. Ask a manager to add, move, count, or record waste.
        </p>
      )}

      <section className="flex flex-wrap gap-2">
        {([
          ["STOCK","Stock items only"],
          ["MENU","Menu items"],
          ["ALL","All products"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`bz-chip ${kind === value ? "bz-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStockType(value)}
            className={`bz-chip ${stockType === value ? "bz-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStatus("ALL")} className={`bz-chip ${status ==="ALL" ?"bz-chip-on" :""}`}>
          All
        </button>
        <button type="button" onClick={() => setStatus(status ==="IN_STOCK" ?"ALL" :"IN_STOCK")} className={`bz-chip ${status ==="IN_STOCK" ?"bz-chip-on" :""}`}>
          In stock
        </button>
        <button type="button" onClick={() => setStatus(status ==="LOW_STOCK" ?"ALL" :"LOW_STOCK")} className={`bz-chip ${status ==="LOW_STOCK" ?"bz-chip-on" :""}`}>
          Low stock {summary.low}
        </button>
        <button type="button" onClick={() => setStatus(status ==="OUT_OF_STOCK" ?"ALL" :"OUT_OF_STOCK")} className={`bz-chip ${status ==="OUT_OF_STOCK" ?"bz-chip-on" :""}`}>
          Out of stock {summary.out}
        </button>
      </section>

      <label className="block text-sm font-medium">
        Search
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, SKU, or category..."
          className="mt-1 min-h-11 w-full rounded-md border border-black bg-white px-3 text-sm font-medium"
        />
      </label>
      {kind ==="MENU" ? (
        <p className="rounded-md border border-black bg-white px-3 py-2 text-sm font-medium text-black">
          These are dishes and drinks sold on the menu. They are not the same as raw stock — Beef Stew is not Beef, and Espresso is not Coffee Beans.
        </p>
      ) : null}

      <div className="space-y-3 md:hidden">
        {visible.map((item) => {
          const qty = qtyAt(item, location);
          const rowStatus = overviewStatus(qty, item.reorderLevel);
          const copy = statusCopy(rowStatus, qty, item.unit);
          const physical = isPhysicalStockProduct(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenId(item.id)}
              className="w-full rounded-md border border-black bg-white p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{item.name}</p>
                <span className="rounded-md border border-black px-2 py-1 text-xs font-medium">
                  {physical ?"Stock" :"Menu"}
                </span>
              </div>
              <p className="mt-3 text-xl font-semibold leading-none text-black">
                <span className="bg-[#FFD758] px-1.5">{formatQuantity(qty, item.unit)}</span>
              </p>
              <p className="mt-2 text-sm font-medium text-black">{whereLine(item, location)}</p>
              <span className={`mt-3 inline-flex min-h-7 items-center rounded-full px-2 py-1 text-xs font-semibold ${copy.className}`}>{copy.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-black bg-white md:block">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-xs font-medium">Product</th>
              <th className="p-3 text-xs font-medium">Available</th>
              <th className="p-3 text-xs font-medium">Location</th>
              <th className="p-3 text-xs font-medium">Status</th>
              <th className="p-3 text-xs font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const qty = qtyAt(item, location);
              const rowStatus = overviewStatus(qty, item.reorderLevel);
              const copy = statusCopy(rowStatus, qty, item.unit);
              const physical = isPhysicalStockProduct(item);
              return (
                <tr key={item.id} className="border-t border-black">
                  <td className="p-3">
                    <button type="button" className="text-left font-semibold" onClick={() => setOpenId(item.id)}>
                      {item.name}
                    </button>
                    <p className="text-xs font-medium text-black">
                      {physical ?"Stock item" :"Menu item"} · {item.categoryName}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="bg-[#FFD758] px-1.5 text-base font-semibold text-black">{formatQuantity(qty, item.unit)}</span>
                  </td>
                  <td className="p-3 text-sm font-medium text-black">{whereLine(item, location)}</td>
                  <td className="p-3">
                    <span className={`inline-flex min-h-7 items-center rounded-full px-2 py-1 text-xs font-semibold ${copy.className}`}>
                      {copy.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => setOpenId(item.id)} className="bz-btn-outline min-h-11 px-3 text-sm">
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? <p className="p-8 text-center font-medium text-black">No products match this search.</p> : null}

      <section className="rounded-md border border-black bg-white">
        <div className="border-b border-black px-4 py-3">
          <h2 className="bz-section-title">Recent stock activity</h2>
        </div>
        {activity.length === 0 ? (
          <p className="p-6 text-sm text-black">No stock activity yet.</p>
        ) : (
          <ul className="divide-y divide-black">
            {activity.slice(0, 8).map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p className="font-semibold">{activitySentence(row)}</p>
                <p className="text-xs text-black">{row.performedBy} · {new Date(row.createdAt).toLocaleString("en-RW")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <ProductDrawer
          item={selected}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onAction={(kind) => {
            setOpenId(null);
            openOp(kind, selected.id);
          }}
        />
      ) : null}

      {op ==="add" && canManage ? (
        <InventoryOperationDialog title="Add stock" description="Something arrived? Choose the item, enter how many, and it goes to Main Store." onClose={() => setOp(null)}>
          <PurchaseForm products={purchaseProducts} initialProductId={opProductId} />
        </InventoryOperationDialog>
      ) : null}
      {op ==="take" && canManage ? (
        <InventoryOperationDialog title="Count stock" description="Count what you actually have. We will show the difference before you save." onClose={() => setOp(null)}>
          <StockTakeForm products={takeProducts} initialProductId={opProductId} />
        </InventoryOperationDialog>
      ) : null}
      {op ==="transfer" && canManage ? (
        <InventoryOperationDialog title="Move stock" description="Move something from Main Store to Bar or Kitchen." onClose={() => setOp(null)}>
          <StockTransferForm products={transferProducts} initialProductId={opProductId} />
        </InventoryOperationDialog>
      ) : null}
      {op ==="waste" && canManage ? (
        <InventoryOperationDialog title="Record waste" description="Something was damaged, expired, or thrown away?" onClose={() => setOp(null)}>
          <WasteForm products={wasteProducts} initialProductId={opProductId} />
        </InventoryOperationDialog>
      ) : null}
    </div>
  );
}

function ProductDrawer({
  item,
  canManage,
  onClose,
  onAction,
}: {
  item: OverviewItem;
  canManage: boolean;
  onClose: () => void;
  onAction: (kind: Exclude<OpKind, null>) => void;
}) {
  const status = overviewStatus(item.total, item.reorderLevel);
  const copy = statusCopy(status, item.total, item.unit);
  const physical = isPhysicalStockProduct(item);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black">
      <button type="button" aria-label="Close drawer" className="absolute inset-0" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-black bg-white">
        <div className="flex items-center justify-between border-b border-black px-4 py-3">
          <h2 className="text-lg font-semibold">{item.name}</h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-md border text-xl font-semibold" aria-label="Close">×</button>
        </div>
        <div className="space-y-5 p-4">
          <section>
            <p className="text-2xl font-semibold leading-none">{formatQuantity(item.total, item.unit)}</p>
            <p className="bz-label mt-2">Available</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex min-h-7 items-center rounded-full px-2 py-1 text-xs font-semibold ${copy.className}`}>{copy.label}</span>
              <span className={`inline-flex min-h-7 items-center rounded-full px-2 py-1 text-xs font-semibold ${physical ?"bg-white text-black" :"bg-white text-black"}`}>
                {physical ?"Stock item" :"Menu item"}
              </span>
            </div>
            {physical ? null : (
              <p className="mt-3 text-sm font-medium text-black">
                This is sold on the menu. Receive and count the matching raw stock instead.
              </p>
            )}
          </section>
          <section>
            <p className="bz-label">Where it is</p>
            <ul className="mt-2 divide-y divide-black rounded-md border border-black">
              {[
                ["Main Store", item.main],
                ["Bar", item.bar],
                ["Kitchen", item.kitchen],
              ].map(([label, qty]) => (
                <li key={label} className="flex items-center justify-between px-3 py-3 text-sm font-medium">
                  <span>{label}</span>
                  <span className="text-lg font-semibold">{formatQuantity(Number(qty), item.unit)}</span>
                </li>
              ))}
            </ul>
          </section>
          {canManage && physical ? (
            <section>
              <p className="bz-label">What do you want to do?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onAction("add")} className="bz-btn-primary min-h-11">Add stock</button>
                <button type="button" onClick={() => onAction("transfer")} className="bz-btn-outline min-h-11">Move stock</button>
                <button type="button" onClick={() => onAction("take")} className="bz-btn-outline min-h-11">Count stock</button>
                <button type="button" onClick={() => onAction("waste")} className="bz-btn-outline min-h-11">Record waste</button>
              </div>
            </section>
          ) : null}
          <section>
            <p className="bz-label">Recent stock activity</p>
            {item.recent.length === 0 ? (
              <p className="mt-2 text-sm text-black">No activity for this product yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {item.recent.slice(0, 8).map((move) => (
                  <li key={move.id} className="text-sm font-medium text-black">
                    {activitySentence({
                      id: move.id,
                      createdAt: move.createdAt,
                      productName: item.name,
                      type: move.type,
                      quantity: move.quantity,
                      balanceAfter: move.balanceAfter,
                      locationCode: move.locationCode,
                      performedBy: move.performedBy,
                      referenceId: move.referenceId,
                    })}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
