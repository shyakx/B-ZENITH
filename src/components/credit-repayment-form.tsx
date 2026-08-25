"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreditRepaymentForm({ bills }: { bills: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (bills.length === 0) return null;

  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/credit/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditBillId: String(form.get("creditBillId")),
          amount: Number(form.get("amount")),
          method: String(form.get("method")),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to record repayment.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record repayment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="grid min-w-0 gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget));
      }}
    >
      <label className="text-xs font-black uppercase tracking-widest text-stone-500">
        Record repayment
        <select name="creditBillId" required className="mt-1 block min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal text-stone-900">
          {bills.map((bill) => (
            <option key={bill.id} value={bill.id}>
              {bill.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-widest text-stone-500">
        Amount
        <input required name="amount" type="number" min="1" step="0.01" className="mt-1 block min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal" />
      </label>
      <label className="text-xs font-black uppercase tracking-widest text-stone-500">
        Method
        <select name="method" className="mt-1 block min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal">
          <option value="CASH">Cash</option>
          <option value="MOBILE_MONEY">Mobile money</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <button disabled={busy} className="min-h-11 w-full rounded-md bg-black px-4 font-bold text-[#d4af37] disabled:opacity-50">
        {busy ? "Saving…" : "Record"}
      </button>
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
    </form>
  );
}
