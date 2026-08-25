"use client";

import { Clock, CheckCircle2, ChefHat, Wine, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FulfillmentStatus, ServiceChannel } from "@prisma/client";

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

  const getStatusColor = (status: FulfillmentStatus) => {
    switch (status) {
      case FulfillmentStatus.POSTED:
        return "bg-blue-100 text-blue-700 border-blue-200";
      case FulfillmentStatus.PREPARING:
        return "bg-amber-100 text-amber-700 border-amber-200";
      case FulfillmentStatus.READY:
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  const getActionLabel = (status: FulfillmentStatus) => {
    switch (status) {
      case FulfillmentStatus.POSTED:
        return "START PREPARING";
      case FulfillmentStatus.PREPARING:
        return "MARK AS READY";
      case FulfillmentStatus.READY:
        return "MARK AS SERVED";
      default:
        return "COMPLETED";
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-x-hidden bg-stone-50 p-4 sm:p-6">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black">
            {locationCode === "BAR" ? <Wine className="text-purple-600" size={32} /> : <ChefHat className="text-amber-600" size={32} />}
            {locationCode} QUEUE
          </h1>
          <p className="text-stone-500">Live order queue for {locationCode.toLowerCase()} fulfillment.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 shadow-sm">
          <Timer size={18} className="text-stone-400" />
          <span className="text-sm font-bold">Auto-refreshing</span>
        </div>
      </header>
      {error && <p className="mb-4 font-bold text-red-600">{error}</p>}

      {loading && items.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-stone-200 border-t-black" />
            <p className="mt-4 font-bold text-stone-500">Loading orders...</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border-2 border-dashed border-stone-200 bg-white shadow-inner">
          <div className="text-center">
            <CheckCircle2 size={64} className="mx-auto text-green-200" />
            <h3 className="mt-6 text-xl font-black text-stone-400">All clear!</h3>
            <p className="mt-2 text-stone-500">No pending orders for {locationCode}.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getStatusColor(item.fulfillmentStatus)}`}>
                  {item.fulfillmentStatus}
                </span>
                <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400">
                  <Clock size={12} /> {item.elapsedMinutes}m ago
                </div>
              </div>

              <div className="flex-1">
                <div className="mb-2 flex items-start gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-900 text-lg font-black text-white">
                    {item.qty}
                  </span>
                  <div>
                    <h4 className="text-lg font-black leading-tight">{item.productName}</h4>
                    {item.variantName && <p className="text-xs font-bold text-[#947313]">{item.variantName}</p>}
                  </div>
                </div>

                <div className="mt-4 space-y-1 rounded-lg bg-stone-50 p-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-stone-400">Channel</span>
                    <span className="text-stone-700">{item.channel.replaceAll("_", " ")}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-stone-400">Session</span>
                    <span className="text-right text-stone-700">
                      {item.tableName ? `Table ${item.tableName}` : item.destination || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-stone-400">Posted by</span>
                    <span className="text-stone-700">{item.postedByName || "Staff"}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-stone-400">Current waiter</span>
                    <span className="text-stone-700">{item.currentWaiterName}</span>
                  </div>
                  {item.fulfillmentStaffName && (
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-stone-400">Fulfillment</span>
                      <span className="text-stone-700">{item.fulfillmentStaffName}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleStatusChange(item.id, item.fulfillmentStatus)}
                className={`mt-6 min-h-12 w-full rounded-lg py-3 text-sm font-black ${
                  item.fulfillmentStatus === FulfillmentStatus.READY
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-black text-[#d4af37] hover:bg-stone-900"
                }`}
              >
                {getActionLabel(item.fulfillmentStatus)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
