"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordWaste } from "@/actions/inventory";
import { WASTE_REASONS, locationLabel } from "@/lib/inventory-totals";

export function WasteForm({
  products,
}: {
  products: Array<{ id: string; name: string; quantities: Record<string, number> }>;
}) {
  const router = useRouter();
  const [locationCode, setLocationCode] = useState("BAR");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const product = products.find((item) => item.id === productId);
  const available = product?.quantities[locationCode] ?? 0;

  async function submit(formData: FormData) {
    setMessage("");
    try {
      await recordWaste(formData);
      setMessage("Waste recorded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Waste could not be recorded.");
    }
  }

  if (!products.length) {
    return <p className="rounded-lg border bg-white p-6 text-sm text-stone-500">No tracked products available.</p>;
  }

  return (
    <form action={submit} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2">
      <label className="text-sm font-bold">
        Location
        <select name="locationCode" value={locationCode} onChange={(event) => setLocationCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          <option value="MAIN_STOCK">Main Stock</option>
          <option value="BAR">Bar</option>
          <option value="KITCHEN">Kitchen</option>
        </select>
      </label>
      <label className="text-sm font-bold">
        Product
        <select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-stone-600 md:col-span-2">
        Available at {locationLabel(locationCode)}: <b>{available}</b>
      </p>
      <label className="text-sm font-bold">
        Quantity
        <input required name="quantity" type="number" min={1} max={available} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      <label className="text-sm font-bold">
        Reason
        <select required name="reason" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
          {WASTE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold md:col-span-2">
        Note (optional)
        <input name="note" maxLength={300} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
      </label>
      {message ? <p className={`text-sm font-bold md:col-span-2 ${message.startsWith("Waste recorded") ? "text-green-700" : "text-red-700"}`}>{message}</p> : null}
      <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37] md:col-span-2">Record waste</button>
    </form>
  );
}
