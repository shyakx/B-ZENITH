"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { transferStock } from "@/actions/inventory";

type ProductOption = { id: string; name: string; mainQuantity: number };

export function StockTransferForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [toCode, setToCode] = useState("BAR");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([{ productId: products[0]?.id ?? "", quantity: 1 }]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () =>
      lines.map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return {
          name: product?.name ?? "Product",
          quantity: line.quantity,
          available: product?.mainQuantity ?? 0,
        };
      }),
    [lines, products],
  );

  async function submit() {
    setPending(true);
    setMessage("");
    const formData = new FormData();
    formData.set("toCode", toCode);
    formData.set("note", note);
    for (const line of lines) {
      formData.append("productId", line.productId);
      formData.append("quantity", String(line.quantity));
    }
    const result = await transferStock(formData);
    setPending(false);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setNote("");
    setLines([{ productId: products[0]?.id ?? "", quantity: 1 }]);
    setMessage("Transfer recorded. Main Stock decreased and the destination increased.");
    router.refresh();
  }

  if (!products.length) {
    return <p className="rounded-lg border bg-white p-6 text-sm text-stone-500">No tracked products are available to transfer.</p>;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">From
          <input readOnly value="Main Stock" className="mt-1 min-h-11 w-full rounded-md border bg-stone-50 px-3 font-normal" />
        </label>
        <label className="text-sm font-bold">To
          <select value={toCode} onChange={(event) => setToCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
          </select>
        </label>
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <select
              value={line.productId}
              onChange={(event) => setLines((current) => current.map((item, i) => (i === index ? { ...item, productId: event.target.value } : item)))}
              className="min-h-11 rounded-md border px-3"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (Main {product.mainQuantity})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => setLines((current) => current.map((item, i) => (i === index ? { ...item, quantity: Number(event.target.value) } : item)))}
              className="min-h-11 rounded-md border px-3"
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setLines((current) => [...current, { productId: products[0].id, quantity: 1 }])} className="mt-3 min-h-11 rounded-md border px-4 font-bold">
        Add product
      </button>
      <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm">
        <p className="font-bold">Summary</p>
        <ul className="mt-2 space-y-1">
          {summary.map((line, index) => (
            <li key={index}>
              {line.quantity} × {line.name} from Main ({line.available} available) to {toCode === "BAR" ? "Bar" : "Kitchen"}
            </li>
          ))}
        </ul>
      </div>
      <label className="mt-4 block text-sm font-bold">Note (optional)
        <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" placeholder="Evening fill after verbal approval" />
      </label>
      {message ? <p className={`mt-3 text-sm font-bold ${message.startsWith("Transfer recorded") ? "text-green-700" : "text-red-700"}`}>{message}</p> : null}
      <button type="button" onClick={submit} disabled={pending} className="mt-4 min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-40">
        {pending ? "Recording…" : "Transfer stock"}
      </button>
    </div>
  );
}
