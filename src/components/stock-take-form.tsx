"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockItemPicker } from "@/components/stock-item-picker";
import { locationLabel } from "@/lib/inventory-totals";
import { formatQuantity } from "@/lib/stock";

type TrackedProduct = {
  id: string;
  name: string;
  categoryName?: string;
  sku?: string;
  stockQuantity: number;
  unit: string;
  locationQuantities: Record<string, number>;
};

export function StockTakeForm({
  products,
  initialProductId,
  initialLocationCode,
}: {
  products: TrackedProduct[];
  initialProductId?: string;
  initialLocationCode?: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(initialProductId ||"");
  const [locationCode, setLocationCode] = useState(initialLocationCode ||"MAIN_STOCK");
  const [counted, setCounted] = useState("");
  const [step, setStep] = useState<"edit" |"confirm">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const product = products.find((item) => item.id === productId);
  const unit = product?.unit ??"PIECE";
  const currentQuantity = product?.locationQuantities[locationCode] ?? 0;
  const countedQuantity = counted ==="" ? null : Number(counted);
  const adjustment = product && countedQuantity !== null && Number.isInteger(countedQuantity)
    ? countedQuantity - currentQuantity
    : null;
  const differenceLabel = adjustment == null
    ? null
    : `${adjustment > 0 ?"+" :""}${formatQuantity(adjustment, unit)}`;

  const canReview = useMemo(() => {
    if (!product || pending) return false;
    if (countedQuantity === null || !Number.isInteger(countedQuantity) || countedQuantity < 0) return false;
    if (adjustment === 0) return false;
    return true;
  }, [adjustment, countedQuantity, pending, product]);

  async function submit() {
    if (!product || countedQuantity === null || adjustment === null) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/inventory/stock-take", {
      method:"POST",
      headers: {"Content-Type":"application/json" },
      body: JSON.stringify({
        productId: product.id,
        locationCode,
        countedQuantity,
        reason:"Physical count",
        confirmNegative: adjustment < 0,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setStep("edit");
      const raw = result.error ??"We couldn't update the stock. Please try again.";
      setMessage(raw.includes("Prisma") ?"We couldn't update the stock. Please try again." : raw);
      return;
    }
    setCounted("");
    setStep("edit");
    setMessage(`Saved count: ${formatQuantity(countedQuantity, unit)} at ${locationLabel(locationCode)}.`);
    router.refresh();
  }

  if (!products.length) {
    return (
      <p className="rounded-lg border bg-white p-6 text-sm text-black">
        No products are available to count.
      </p>
    );
  }

  if (step ==="confirm" && product && countedQuantity !== null && adjustment !== null) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-black">System says {formatQuantity(currentQuantity, unit)}</p>
        <p className="text-sm font-medium text-black">You counted {formatQuantity(countedQuantity, unit)}</p>
        <p className="text-lg font-semibold">Difference: {differenceLabel}</p>
        <p className="text-sm font-medium text-black">
          {locationLabel(locationCode)} · {product.name}
        </p>
        <p className="text-lg font-semibold">Save this count?</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={pending} onClick={() => setStep("edit")} className="min-h-12 rounded-md border font-bold">Cancel</button>
          <button type="button" disabled={pending} onClick={submit} className="bz-btn-primary disabled:border-2 disabled:border-dashed">
            {pending ?"Saving..." :"Save this count"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StockItemPicker
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          categoryName: item.categoryName,
          unit: item.unit,
          available: item.locationQuantities[locationCode] ?? 0,
        }))}
        value={productId}
        onChange={(id) => {
          setProductId(id);
          setMessage("");
        }}
      />
      <label className="block text-sm font-bold">
        Where are you counting?
        <select value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          <option value="MAIN_STOCK">Main Store</option>
          <option value="BAR">Bar</option>
          <option value="KITCHEN">Kitchen</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-black">System says</p>
          <p className="mt-1 text-2xl font-semibold">{formatQuantity(currentQuantity, unit)}</p>
        </article>
        <label className="text-sm font-bold">
          You counted
          <input
            type="number"
            min="0"
            step="1"
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            placeholder="What you actually have"
            className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal"
          />
        </label>
      </div>
      {countedQuantity !== null && Number.isInteger(countedQuantity) && product ? (
        <p className="text-sm font-medium text-black">
          {adjustment === 0
            ?"This matches the system. Nothing to save."
            : `Difference: ${differenceLabel}`}
        </p>
      ) : null}
      {message ? (
        <p className={message.startsWith("Saved count") ?"bz-success" :"bz-alert"}>
          {message}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canReview}
        onClick={() => { setMessage(""); setStep("confirm"); }}
        className="bz-btn-primary min-h-12 w-full disabled:border-2 disabled:border-dashed"
      >
        Review count
      </button>
    </div>
  );
}
