"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockItemPicker } from "@/components/stock-item-picker";
import { formatQuantity } from "@/lib/stock";

type AddStockProduct = {
  id: string;
  name: string;
  sku?: string;
  categoryName?: string;
  available?: number;
  mainQuantity?: number;
  unit?: string;
  costPrice?: number;
};

export function PurchaseForm({
  products,
  initialProductId,
}: {
  suppliers?: Array<{ id: string; name: string }>;
  products: AddStockProduct[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(initialProductId ||"");
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<"edit" |"confirm">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const product = products.find((item) => item.id === productId) ?? null;
  const available = product?.available ?? product?.mainQuantity ?? 0;
  const unit = product?.unit ??"PIECE";
  const qtyLabel = formatQuantity(quantity, unit);

  async function submit() {
    if (!product || quantity < 1) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/purchases", {
      method:"POST",
      headers: {"Content-Type":"application/json" },
      body: JSON.stringify({
        supplierId: null,
        referenceNumber: `ADD-${Date.now()}`,
        items: [{ productId: product.id, quantity }],
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setStep("edit");
      const raw = result.error ??"";
      setMessage(
        !raw || raw.includes("Prisma") || /purchase/i.test(raw)
          ?"We couldn't add the stock. Please try again."
          : raw,
      );
      return;
    }
    setQuantity(1);
    setStep("edit");
    setMessage(`Added ${formatQuantity(quantity, unit)} of ${product.name} to Main Store.`);
    router.refresh();
  }

  if (!products.length) {
    return <p className="rounded-lg border bg-white p-6 text-sm text-black">No stock items are available to add.</p>;
  }

  if (step ==="confirm" && product) {
    return (
      <div className="space-y-4 rounded-lg border border-black bg-white p-4">
        <p className="text-lg font-semibold text-black">
          Add {qtyLabel} of {product.name} to Main Store?
        </p>
        <p className="text-sm font-medium text-black">
          Arrivals go to Main Store first. Move them to Bar or Kitchen after that.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={pending} onClick={() => setStep("edit")} className="min-h-12 rounded-md border font-bold">
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={submit} className="bz-btn-primary disabled:border-2 disabled:border-dashed">
            {pending ?"Adding..." :"Confirm"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-black bg-white p-4">
      <StockItemPicker
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          categoryName: item.categoryName,
          unit: item.unit,
          available: item.available ?? item.mainQuantity ?? 0,
        }))}
        value={productId}
        onChange={(id) => {
          setProductId(id);
          setMessage("");
        }}
      />

      {product ? (
        <>
          <label className="block text-sm font-bold">
            How many arrived?
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="mt-1 min-h-14 w-full rounded-md border border-black px-3 text-2xl font-semibold"
            />
          </label>
          <label className="block text-sm font-bold">
            Where it arrives
            <input readOnly value="Main Store" className="mt-1 min-h-11 w-full rounded-md border bg-white px-3 font-normal" />
          </label>
          <p className="text-sm font-medium text-black">
            {product.name} currently has {formatQuantity(available, unit)}.
          </p>
        </>
      ) : (
        <p className="text-sm font-medium text-black">Choose an item, then enter how many arrived.</p>
      )}

      {message ? (
        <p className={message.startsWith("Added") ?"bz-success" :"bz-alert"}>
          {message}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!product || quantity < 1}
        onClick={() => { setMessage(""); setStep("confirm"); }}
        className="bz-btn-primary min-h-14 w-full text-lg disabled:border-2 disabled:border-dashed"
      >
        Add {product ? qtyLabel :"stock"}
      </button>
    </div>
  );
}
