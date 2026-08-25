"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockItemPicker } from "@/components/stock-item-picker";
import { recordWaste } from "@/actions/inventory";
import { SIMPLE_WASTE_REASONS, locationLabel, wasteReasonLabel } from "@/lib/inventory-totals";
import { formatQuantity } from "@/lib/stock";

export function WasteForm({
  products,
  initialProductId,
  initialLocationCode,
}: {
  products: Array<{
    id: string;
    name: string;
    sku?: string;
    categoryName?: string;
    unit?: string;
    quantities: Record<string, number>;
  }>;
  initialProductId?: string;
  initialLocationCode?: string;
}) {
  const router = useRouter();
  const [locationCode, setLocationCode] = useState(initialLocationCode || "BAR");
  const [productId, setProductId] = useState(initialProductId || "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<(typeof SIMPLE_WASTE_REASONS)[number]>("DAMAGED");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const product = products.find((item) => item.id === productId);
  const unit = product?.unit ?? "PIECE";
  const available = product?.quantities[locationCode] ?? 0;

  async function submit() {
    setPending(true);
    setMessage("");
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("locationCode", locationCode);
    formData.set("quantity", String(quantity));
    formData.set("reason", reason);
    formData.set("note", note);
    try {
      await recordWaste(formData);
      setStep("edit");
      setMessage(`Recorded ${formatQuantity(quantity, unit)} of ${product?.name ?? "stock"} as waste.`);
      router.refresh();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setStep("edit");
      setMessage(raw.includes("Prisma") || !raw ? "We couldn't update the stock. Please try again." : raw);
    } finally {
      setPending(false);
    }
  }

  if (!products.length) {
    return <p className="rounded-lg border bg-white p-6 text-sm text-stone-600">No products available.</p>;
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <p className="text-lg font-black">
          Remove {formatQuantity(quantity, unit)} of {product?.name} from {locationLabel(locationCode)}?
        </p>
        <p className="text-sm">Reason: <b>{wasteReasonLabel(reason)}</b></p>
        <p className="text-sm">Left after this: <b>{formatQuantity(available - quantity, unit)}</b></p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={pending} onClick={() => setStep("edit")} className="min-h-12 rounded-md border font-bold">Cancel</button>
          <button type="button" disabled={pending} onClick={submit} className="min-h-12 rounded-md bg-red-800 font-bold text-white disabled:opacity-40">
            {pending ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <StockItemPicker
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          categoryName: item.categoryName,
          unit: item.unit,
          available: item.quantities[locationCode] ?? 0,
        }))}
        value={productId}
        onChange={(id) => {
          setProductId(id);
          setMessage("");
        }}
      />
      <label className="text-sm font-bold">
        Where
        <select value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          <option value="MAIN_STOCK">Main Store</option>
          <option value="BAR">Bar</option>
          <option value="KITCHEN">Kitchen</option>
        </select>
      </label>
      <p className="text-sm text-stone-600">
        Currently at {locationLabel(locationCode)}: <b>{formatQuantity(available, unit)}</b>
      </p>
      <label className="text-sm font-bold">
        How many were wasted?
        <input type="number" min={1} max={Math.max(1, available)} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      <label className="text-sm font-bold">
        Why?
        <select value={reason} onChange={(event) => setReason(event.target.value as (typeof SIMPLE_WASTE_REASONS)[number])} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          {SIMPLE_WASTE_REASONS.map((item) => (
            <option key={item} value={item}>{wasteReasonLabel(item)}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Notes (optional)
        <input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      {message ? <p className={`text-sm font-bold ${message.startsWith("Recorded ") ? "text-emerald-700" : "text-red-700"}`}>{message}</p> : null}
      <button
        type="button"
        disabled={!product || quantity < 1 || quantity > available}
        onClick={() => { setMessage(""); setStep("confirm"); }}
        className="min-h-12 rounded-md bg-black px-5 font-bold text-[#d4af37] disabled:opacity-40"
      >
        Remove {product ? formatQuantity(quantity, unit) : "stock"}
      </button>
    </div>
  );
}
