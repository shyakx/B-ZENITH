"use client";

import { ChefHat, Wine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FulfillmentStatus, ServiceChannel } from "@prisma/client";
import { EmptyState, StatusBadge } from "@/components/dashboard/ui";

interface FulfillmentItem {
  id: string;
  qty: number;
  productName: string;
  variantName: string | null;
  fulfillmentStatus: FulfillmentStatus;
  postedAt: string;
  tableName: string | null;
  channel: ServiceChannel;
  destination: string | null;
  postedByName: string | null;
  currentWaiterName: string;
  fulfillmentStaffName: string | null;
  elapsedMinutes: number;
}

const COLUMNS: Array<{ status: FulfillmentStatus; title: string; tone: "warn" | "info" | "ok" }> = [
  { status: FulfillmentStatus.POSTED, title: "Pending", tone: "warn" },
  { status: FulfillmentStatus.PREPARING, title: "Preparing", tone: "info" },
  { status: FulfillmentStatus.READY, title: "Ready", tone: "ok" },
];

export function FulfillmentQueue({ locationCode }: { locationCode: "BAR" | "KITCHEN" }) {
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/fulfillment?location=${locationCode}`);
      if (!res.ok) throw new Error("Unable to load queue.");
      setItems(await res.json());
      setError("");
    } catch (err) {
      console.error("Failed to fetch fulfillment items", err);
      setError("Could not refresh the queue.");
    } finally {
      setLoading(false);
    }
  }, [locationCode]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const handleStatusChange = async (itemId: string, currentStatus: FulfillmentStatus) => {
    let nextStatus: FulfillmentStatus;
    if (currentStatus === FulfillmentStatus.POSTED) nextStatus = FulfillmentStatus.PREPARING;
    else if (currentStatus === FulfillmentStatus.PREPARING) nextStatus = FulfillmentStatus.READY;
    else if (currentStatus === FulfillmentStatus.READY) nextStatus = FulfillmentStatus.SERVED;
    else return;

    const res = await fetch("/api/fulfillment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, status: nextStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to update status");
      return;
    }
    await fetchItems();
  };

  const actionLabel = (status: FulfillmentStatus) => {
    if (status === FulfillmentStatus.POSTED) return "Start preparing";
    if (status === FulfillmentStatus.PREPARING) return "Mark ready";
    if (status === FulfillmentStatus.READY) return "Hand over";
    return "Done";
  };

  const card = (item: FulfillmentItem) => {
    const stale = item.elapsedMinutes >= 15;
    return (
      <article
        key={item.id}
        className={`flex flex-col rounded-lg border bg-white p-4 ${stale ? "border-amber-500" : "border-stone-300"}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <StatusBadge tone={item.fulfillmentStatus === "READY" ? "ok" : item.fulfillmentStatus === "PREPARING" ? "info" : "warn"}>
            {item.fulfillmentStatus === "POSTED" ? "Pending" : item.fulfillmentStatus === "READY" ? "Ready" : "Preparing"}
          </StatusBadge>
          <span className={`text-sm font-black ${stale ? "text-amber-700" : "text-stone-500"}`}>{item.elapsedMinutes}m</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-black text-xl font-black text-[#d4af37]">
            {item.qty}
          </span>
          <div>
            <h3 className="text-xl font-black leading-tight">{item.productName}</h3>
            {item.variantName ? <p className="text-sm font-bold text-[#947313]">{item.variantName}</p> : null}
            <p className="mt-1 text-sm font-medium text-stone-600">
              {item.tableName ? `Table ${item.tableName}` : item.destination || item.channel.replaceAll("_", " ")}
            </p>
            <p className="text-xs text-stone-500">Waiter {item.currentWaiterName}</p>
          </div>
        </div>
        <button
          onClick={() => handleStatusChange(item.id, item.fulfillmentStatus)}
          className={`mt-4 min-h-14 w-full rounded-md text-base font-black ${
            item.fulfillmentStatus === FulfillmentStatus.READY ? "bg-emerald-700 text-white" : "bg-black text-[#d4af37]"
          }`}
        >
          {actionLabel(item.fulfillmentStatus)}
        </button>
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Fulfillment</p>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight md:text-4xl">
            {locationCode === "BAR" ? <Wine size={28} /> : <ChefHat size={28} />}
            {locationCode === "BAR" ? "Bar queue" : "Kitchen queue"}
          </h1>
          <p className="mt-1 text-sm font-medium text-stone-600">What needs to be prepared now.</p>
        </div>
        <StatusBadge tone="neutral">Live · 10s refresh</StatusBadge>
      </header>
      {error ? <p className="font-bold text-red-700">{error}</p> : null}

      {loading && items.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-40 animate-pulse rounded-lg border border-stone-300 bg-stone-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-stone-300 bg-white">
          <EmptyState title="All clear." body={`No pending ${locationCode.toLowerCase()} orders.`} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnItems = items.filter((item) => item.fulfillmentStatus === column.status);
            return (
              <section key={column.status} className="rounded-lg border border-stone-300 bg-stone-50">
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-stone-700">{column.title}</h2>
                  <StatusBadge tone={column.tone}>{columnItems.length}</StatusBadge>
                </div>
                <div className="space-y-3 p-3">
                  {columnItems.length === 0 ? (
                    <p className="py-8 text-center text-sm font-medium text-stone-500">None</p>
                  ) : (
                    columnItems.map(card)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
