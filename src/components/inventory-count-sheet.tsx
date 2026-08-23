"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/datetime";
import { locationLabel } from "@/lib/inventory-totals";

type CountProduct = {
  id: string;
  name: string;
  categoryName: string;
  unit: string;
  costPrice: number;
  quantities: Record<string, number>;
};

export function InventoryCountSheet({ products, currency }: { products: CountProduct[]; currency: string }) {
  const router = useRouter();
  const [locationCode, setLocationCode] = useState("MAIN_STOCK");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("Physical opening count");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const rows = useMemo(
    () =>
      products.map((product) => {
        const system = product.quantities[locationCode] ?? 0;
        const raw = counts[product.id];
        const physical = raw === undefined || raw === "" ? null : Number(raw);
        const difference = physical === null || !Number.isInteger(physical) ? null : physical - system;
        return { product, system, physical, difference };
      }),
    [counts, locationCode, products],
  );

  const changed = rows.filter((row) => row.difference !== null && row.difference !== 0 && (row.physical ?? 0) >= 0);

  async function save() {
    setPending(true);
    setMessage("");
    let saved = 0;
    for (const row of changed) {
      const response = await fetch("/api/inventory/stock-take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.product.id,
          locationCode,
          countedQuantity: row.physical,
          reason: note.trim() || "Physical count",
          confirmNegative: (row.difference ?? 0) < 0,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setPending(false);
        setMessage(result.error ?? `Could not save ${row.product.name}.`);
        return;
      }
      saved += 1;
    }
    setPending(false);
    setCounts({});
    setMessage(saved ? `Saved ${saved} physical count${saved === 1 ? "" : "s"} for ${locationLabel(locationCode)}.` : "No quantity changes to save.");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">
          Location
          <select value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
            <option value="MAIN_STOCK">Main Stock</option>
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Count note
          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
        </label>
      </div>
      <p className="text-sm text-stone-500">
        Enter the physical quantity after counting {locationLabel(locationCode)}. Empty rows are skipped. Each save writes a STOCK_TAKE movement.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">System</th>
              <th className="p-3">Physical count</th>
              <th className="p-3">Difference</th>
              <th className="p-3">Unit cost</th>
              <th className="p-3">Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ product, system, physical, difference }) => (
              <tr key={product.id}>
                <td className="p-3 font-bold">{product.name}</td>
                <td className="p-3">{product.categoryName}</td>
                <td className="p-3">{system}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={counts[product.id] ?? ""}
                    onChange={(event) => setCounts((current) => ({ ...current, [product.id]: event.target.value }))}
                    className="min-h-10 w-28 rounded-md border px-2"
                    placeholder={String(system)}
                  />
                </td>
                <td className={`p-3 font-bold ${difference === null || difference === 0 ? "" : difference > 0 ? "text-green-700" : "text-red-700"}`}>
                  {difference === null ? "—" : `${difference > 0 ? "+" : ""}${difference}`}
                </td>
                <td className="p-3">{formatMoney(product.costPrice, currency)}</td>
                <td className="p-3">{formatMoney((physical ?? system) * product.costPrice, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className={`text-sm font-bold ${message.startsWith("Saved") ? "text-green-700" : "text-red-700"}`}>{message}</p> : null}
      <button type="button" onClick={save} disabled={pending || changed.length === 0} className="min-h-12 rounded-md bg-black px-6 font-bold text-[#d4af37] disabled:opacity-40">
        {pending ? "Saving counts…" : `Save ${changed.length} count${changed.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
