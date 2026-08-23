"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type TrackedProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
  locationQuantities: Record<string, number>;
};

export function StockTakeForm({ products }: { products: TrackedProduct[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [locationCode, setLocationCode] = useState("MAIN_STOCK");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [confirmNegative, setConfirmNegative] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const product = products.find((item) => item.id === productId);
  const currentQuantity = product?.locationQuantities[locationCode] ?? 0;
  const countedQuantity = counted === "" ? null : Number(counted);
  const adjustment = product && countedQuantity !== null && Number.isInteger(countedQuantity)
    ? countedQuantity - currentQuantity
    : null;

  const canSubmit = useMemo(() => {
    if (!product || pending) return false;
    if (countedQuantity === null || !Number.isInteger(countedQuantity) || countedQuantity < 0) return false;
    if (!reason.trim() || reason.trim().length < 3) return false;
    if (adjustment === 0) return false;
    if (adjustment !== null && adjustment < 0 && !confirmNegative) return false;
    return true;
  }, [adjustment, confirmNegative, countedQuantity, pending, product, reason]);

  async function submit() {
    if (!product || countedQuantity === null) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/inventory/stock-take", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        locationCode,
        countedQuantity,
        reason: reason.trim(),
        confirmNegative: adjustment !== null && adjustment < 0,
      }),
    });
    const result = (await response.json()) as { error?: string; productName?: string; adjustment?: number };
    setPending(false);
    if (!response.ok) {
      setMessage(result.error ?? "Stock take failed.");
      return;
    }
    setCounted("");
    setConfirmNegative(false);
    setMessage(
      `${result.productName} updated. Adjustment ${result.adjustment && result.adjustment > 0 ? "+" : ""}${result.adjustment}.`,
    );
    router.refresh();
  }

  if (!products.length) {
    return (
      <p className="rounded-lg border bg-white p-6 text-sm text-stone-500">
        No tracked products are available for a stock take.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">Location
          <select value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
            <option value="MAIN_STOCK">Main Stock</option>
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
          </select>
        </label>
        <label className="text-sm font-bold">Product
          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setConfirmNegative(false);
              setMessage("");
            }}
            className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal"
          >
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">Physical count
          <input
            type="number"
            min="0"
            step="1"
            value={counted}
            onChange={(event) => {
              setCounted(event.target.value);
              setConfirmNegative(false);
            }}
            placeholder="Quantity on hand"
            className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-md bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Current stock</p>
          <p className="mt-1 text-2xl font-black">{currentQuantity}</p>
        </article>
        <article className="rounded-md bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Physical count</p>
          <p className="mt-1 text-2xl font-black">{countedQuantity ?? "—"}</p>
        </article>
        <article className="rounded-md bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Adjustment</p>
          <p className={`mt-1 text-2xl font-black ${adjustment === null || adjustment === 0 ? "" : adjustment > 0 ? "text-green-700" : "text-red-700"}`}>
            {adjustment === null ? "—" : `${adjustment > 0 ? "+" : ""}${adjustment}`}
          </p>
        </article>
      </div>
      <label className="mt-4 block text-sm font-bold">Reason
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          placeholder="Opening Stock Take"
          className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal"
        />
      </label>
      {adjustment !== null && adjustment < 0 && (
        <label className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          <input
            type="checkbox"
            checked={confirmNegative}
            onChange={(event) => setConfirmNegative(event.target.checked)}
            className="mt-1"
          />
          I confirm this will reduce stock by {Math.abs(adjustment)} {product?.unit.toLowerCase() ?? "units"}.
        </label>
      )}
      {message && (
        <p className={`mt-3 text-sm font-bold ${message.includes("updated") ? "text-green-700" : "text-red-700"}`}>
          {message}
        </p>
      )}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-40"
      >
        {pending ? "Recording…" : "Confirm stock take"}
      </button>
    </div>
  );
}
