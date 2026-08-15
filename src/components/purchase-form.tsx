"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Line = { productId: string; quantity: number; unitCost: string };

export function PurchaseForm({
  suppliers,
  products,
}: {
  suppliers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const empty = (): Line => ({ productId: products[0]?.id ?? "", quantity: 1, unitCost: "0" });
  const [supplierId, setSupplierId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [items, setItems] = useState<Line[]>([empty()]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const total = items.reduce((sum, item) => sum + item.quantity * Number(item.unitCost || 0), 0);

  async function submit() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: supplierId || null, referenceNumber, items }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Purchase failed.");
    setReferenceNumber("");
    setItems([empty()]);
    setMessage("Purchase received and inventory updated.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal"><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="text-sm font-bold">Reference number<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} required className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-md bg-stone-50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <select value={item.productId} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, productId: event.target.value } : line))} className="min-h-11 rounded-md border px-3">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            <input aria-label="Quantity" type="number" min="1" value={item.quantity} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, quantity: Number(event.target.value) } : line))} className="min-h-11 rounded-md border px-3" />
            <input aria-label="Unit cost" type="number" min="0.01" step="0.01" value={item.unitCost} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, unitCost: event.target.value } : line))} className="min-h-11 rounded-md border px-3" />
            <button aria-label="Remove line" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} disabled={items.length === 1} className="grid size-11 place-items-center rounded-md border text-red-700 disabled:opacity-30"><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setItems((current) => [...current, empty()])} className="flex min-h-11 items-center gap-2 rounded-md border px-4 font-bold"><Plus size={17} /> Add product</button>
        <p className="text-xl font-black">{total.toLocaleString("en-RW")} RWF</p>
      </div>
      {message && <p className={`mt-3 text-sm font-bold ${message.startsWith("Purchase received") ? "text-green-700" : "text-red-700"}`}>{message}</p>}
      <button onClick={submit} disabled={pending || !referenceNumber || !products.length} className="mt-4 min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-40">{pending ? "Receiving…" : "Receive purchase"}</button>
    </div>
  );
}
