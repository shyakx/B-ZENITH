"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = { id: string; name: string; available: number; unitPrice: string };

export function ReturnForm({ saleId, items }: { saleId: string; items: Item[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const selected = items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const total = selected.reduce((sum, item) => sum + Number(item.unitPrice) * quantities[item.id], 0);

  async function submit() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId, reason, items: selected.map((item) => ({ saleItemId: item.id, quantity: quantities[item.id] })) }),
    });
    const result = (await response.json()) as { returnNumber?: string; error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Return failed.");
    setMessage(`Return ${result.returnNumber} completed.`);
    setQuantities({});
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.id} className="grid items-center gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto]">
            <span><b>{item.name}</b><span className="block text-sm text-stone-500">{Number(item.unitPrice).toLocaleString("en-RW")} RWF · {item.available} returnable</span></span>
            <input type="number" min="0" max={item.available} value={quantities[item.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} className="min-h-11 w-28 rounded-md border px-3" />
          </label>
        ))}
      </div>
      <label className="block text-sm font-bold">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-md border p-3 font-normal" /></label>
      <div className="flex justify-between text-xl font-black"><span>Return total</span><span>{total.toLocaleString("en-RW")} RWF</span></div>
      {message && <p className={`font-bold ${message.startsWith("Return RET") ? "text-green-700" : "text-red-700"}`}>{message}</p>}
      <button onClick={submit} disabled={pending || !selected.length || reason.trim().length < 3} className="min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-40">{pending ? "Processing…" : "Process return"}</button>
    </div>
  );
}
