"use client";

import { useMemo, useState } from "react";
import { saveManagerProductReferenceAction } from "@/actions/inventory";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

type Row = {
  id: string;
  name: string;
  category: string;
  unitCode: string | null;
  trackInventory: boolean;
  managerReferenceName: string | null;
  managerReferenceNote: string | null;
};

export function ProductNamesUnitsEditor({ products }: { products: Row[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      products.filter((product) =>
        matchesSearch(
          query,
          product.name,
          product.category,
          product.unitCode,
          product.managerReferenceName,
          product.managerReferenceNote,
        ),
      ),
    [products, query],
  );

  return (
    <div className="space-y-3">
      <ListSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by product, nickname, category, or unit…"
      />
      {visible.length === 0 ? (
        <p className="text-sm text-zenith-muted">
          {query.trim() ? "No products match that search." : "No products yet."}
        </p>
      ) : null}
      {visible.map((product) => (
        <ProductReferenceRow key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductReferenceRow({ product }: { product: Row }) {
  const [name, setName] = useState(product.managerReferenceName ?? "");
  const [note, setNote] = useState(product.managerReferenceNote ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty =
    name.trim() !== (product.managerReferenceName ?? "") ||
    note.trim() !== (product.managerReferenceNote ?? "");

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveManagerProductReferenceAction({
      productId: product.id,
      managerReferenceName: name.trim() || null,
      managerReferenceNote: note.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Saved");
  }

  return (
    <div className="rounded-xl border border-zenith-border bg-white p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-semibold">{product.name}</div>
          <div className="text-xs text-zenith-muted">
            {product.category}
            {product.unitCode ? ` · Official unit: ${product.unitCode}` : " · No stock unit"}
            {product.trackInventory ? "" : " · Not tracked"}
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Manager reference name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Heineken can"
            maxLength={80}
          />
        </Field>
        <Field label="Note (optional)">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. 500ml"
            maxLength={160}
          />
        </Field>
        <Button type="button" disabled={busy || !dirty} onClick={save} className="h-11">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-zenith-muted">{message}</p> : null}
    </div>
  );
}
