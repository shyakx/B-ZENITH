"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockItemPicker } from "@/components/stock-item-picker";
import { transferStock } from "@/actions/inventory";
import { locationLabel } from "@/lib/inventory-totals";
import { formatQuantity } from "@/lib/stock";

export type TransferProductOption = {
  id: string;
  name: string;
  sku?: string;
  categoryName?: string;
  unit?: string;
  mainQuantity: number;
  barQuantity: number;
  kitchenQuantity: number;
};

export function StockTransferForm({
  products,
  initialProductId,
}: {
  products: TransferProductOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [toCode, setToCode] = useState<"BAR" |"KITCHEN">("BAR");
  const [note, setNote] = useState("");
  const [productId, setProductId] = useState(initialProductId ||"");
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<"edit" |"confirm">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const product = products.find((item) => item.id === productId);
  const unit = product?.unit ??"PIECE";
  const destAfter = (toCode ==="BAR" ? (product?.barQuantity ?? 0) : (product?.kitchenQuantity ?? 0)) + quantity;
  const sourceAfter = (product?.mainQuantity ?? 0) - quantity;

  const preview = useMemo(() => {
    if (!product) return null;
    return {
      name: product.name,
      quantity,
      unit,
      from: locationLabel("MAIN_STOCK"),
      to: locationLabel(toCode),
      sourceBefore: product.mainQuantity,
      sourceAfter,
      destBefore: toCode ==="BAR" ? product.barQuantity : product.kitchenQuantity,
      destAfter,
    };
  }, [destAfter, product, quantity, sourceAfter, toCode, unit]);

  async function submit() {
    if (!product) return;
    setPending(true);
    setMessage("");
    const formData = new FormData();
    formData.set("toCode", toCode);
    formData.set("note", note);
    formData.append("productId", product.id);
    formData.append("quantity", String(quantity));
    const result = await transferStock(formData);
    setPending(false);
    if (result &&"error" in result && result.error) {
      setStep("edit");
      setMessage(result.error.includes("Prisma") ?"We couldn't update the stock. Please try again." : result.error);
      return;
    }
    const moved = preview;
    setNote("");
    setQuantity(1);
    setStep("edit");
    setMessage(moved ? `Moved ${formatQuantity(moved.quantity, moved.unit)} of ${moved.name} to ${moved.to}.` :"Stock updated.");
    router.refresh();
  }

  if (!products.length) {
    return <p className="rounded-lg border bg-white p-6 text-sm text-black">No products are available to move.</p>;
  }

  const totalAvailable = (product?.mainQuantity ?? 0) + (product?.barQuantity ?? 0) + (product?.kitchenQuantity ?? 0);

  if (step ==="confirm" && preview) {
    return (
      <div className="space-y-4">
        <p className="text-lg font-semibold">
          Move {formatQuantity(preview.quantity, preview.unit)} of {preview.name} from {preview.from} to {preview.to}?
        </p>
        <p className="rounded-md bg-white p-3 text-sm font-medium text-black">
          Total stays {formatQuantity(totalAvailable, preview.unit)}.
          <span className="mt-1 block">{preview.from}: {formatQuantity(preview.sourceAfter, preview.unit)} · {preview.to}: {formatQuantity(preview.destAfter, preview.unit)}</span>
        </p>
        {message ? <p className="bz-alert">{message}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={pending} onClick={() => setStep("edit")} className="min-h-12 rounded-md border border-black font-bold">
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={submit} className="bz-btn-primary min-h-12 disabled:border-2 disabled:border-dashed">
            {pending ?"Moving..." :"Confirm move"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-black">
        Move something from Main Store to Bar or Kitchen. The total quantity does not change.
      </p>
      <StockItemPicker
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          categoryName: item.categoryName,
          unit: item.unit,
          available: item.mainQuantity,
        }))}
        value={productId}
        onChange={(id) => {
          setProductId(id);
          setMessage("");
        }}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">
          Where it is now
          <input readOnly value={locationLabel("MAIN_STOCK")} className="mt-1 min-h-11 w-full rounded-md border bg-white px-3 font-normal" />
        </label>
        <label className="text-sm font-bold">
          Where it is going
          <select value={toCode} onChange={(event) => setToCode(event.target.value as"BAR" |"KITCHEN")} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-bold">
        How many?
        <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      <label className="block text-sm font-bold">
        Note (optional)
        <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      {product && quantity > 0 ? (
        <p className="text-sm font-medium text-black">
          Move {formatQuantity(quantity, unit)} of {product.name} from Main Store to {locationLabel(toCode)}?
        </p>
      ) : null}
      {message ? (
        <p className={message.startsWith("Moved") ?"bz-success" :"bz-alert"}>{message}</p>
      ) : null}
      <button
        type="button"
        disabled={!product || quantity < 1}
        onClick={() => { setMessage(""); setStep("confirm"); }}
        className="bz-btn-primary min-h-12 w-full disabled:border-2 disabled:border-dashed"
      >
        Review move
      </button>
    </div>
  );
}
