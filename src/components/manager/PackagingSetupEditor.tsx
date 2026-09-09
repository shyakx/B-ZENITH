"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductPackagingAction } from "@/actions/catalog";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export type PackagingRow = {
  id: string;
  name: string;
  categoryName: string;
  stockUnitId: string | null;
  stockUnitCode: string | null;
  stockUnitName: string | null;
  packageUnitId: string | null;
  packageUnitCode: string | null;
  unitsPerPackage: number | null;
  wholePackageTransfer: boolean;
};

type UnitOption = { id: string; code: string; name: string };

export function PackagingSetupEditor({
  products,
  units,
}: {
  products: PackagingRow[];
  units: UnitOption[];
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      products.filter((row) =>
        matchesSearch(query, row.name, row.categoryName, row.stockUnitCode, row.packageUnitCode),
      ),
    [products, query],
  );

  return (
    <div className="space-y-4">
      <ListSearchField value={query} onChange={setQuery} placeholder="Search product…" />
      <div className="space-y-3">
        {visible.map((product) => (
          <PackagingCard key={product.id} product={product} units={units} />
        ))}
        {visible.length === 0 ? (
          <p className="rounded-xl border border-zenith-border bg-white px-4 py-5 text-sm text-zenith-muted">
            No products match that search.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PackagingCard({ product, units }: { product: PackagingRow; units: UnitOption[] }) {
  const router = useRouter();
  const [packageUnitId, setPackageUnitId] = useState(product.packageUnitId ?? "");
  const [unitsPerPackage, setUnitsPerPackage] = useState(
    product.unitsPerPackage != null ? String(product.unitsPerPackage) : "",
  );
  const [wholeOnly, setWholeOnly] = useState(product.wholePackageTransfer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const stockLabel = product.stockUnitCode ?? "—";
  const packageDiffers = Boolean(packageUnitId && product.stockUnitId && packageUnitId !== product.stockUnitId);
  const configured =
    Boolean(product.packageUnitId) &&
    product.packageUnitId !== product.stockUnitId &&
    product.unitsPerPackage != null &&
    product.unitsPerPackage > 0;
  const dirty =
    (packageUnitId || "") !== (product.packageUnitId ?? "") ||
    (packageDiffers ? unitsPerPackage : "") !==
      (product.unitsPerPackage != null && product.packageUnitId !== product.stockUnitId
        ? String(product.unitsPerPackage)
        : "") ||
    wholeOnly !== product.wholePackageTransfer;

  async function onSave() {
    if (
      !window.confirm(
        `Save packaging for ${product.name}? Stock quantities on hand will not change.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveProductPackagingAction({
        productId: product.id,
        packageUnitId: packageUnitId || null,
        unitsPerPackage: packageDiffers && unitsPerPackage ? Number(unitsPerPackage) : null,
        wholePackageTransfer: packageDiffers ? wholeOnly : false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Packaging saved. Stock quantities were not changed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-zenith-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zenith-gold">{product.name}</h3>
          <p className="text-sm text-zenith-muted">{product.categoryName}</p>
        </div>
        <span
          className={
            configured
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-zenith-success"
              : "rounded-md border border-zenith-border bg-zenith-surface px-2 py-1 text-xs font-semibold text-zenith-muted"
          }
        >
          {configured
            ? `1 ${product.packageUnitCode} = ${product.unitsPerPackage} ${product.stockUnitCode}`
            : "—"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Stock unit</div>
          <div className="mt-1 font-semibold">{stockLabel}</div>
        </div>
        <Field label="Package">
          <Select value={packageUnitId} onChange={(event) => setPackageUnitId(event.target.value)}>
            <option value="">None</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Units per package">
          <Input
            type="number"
            min={1}
            placeholder={packageDiffers ? "Enter number" : "—"}
            value={packageDiffers ? unitsPerPackage : ""}
            disabled={!packageDiffers}
            onChange={(event) => setUnitsPerPackage(event.target.value)}
          />
        </Field>
        <label className="flex items-start gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={packageDiffers ? wholeOnly : false}
            disabled={!packageDiffers}
            onChange={(event) => setWholeOnly(event.target.checked)}
          />
          <span className="font-semibold">Whole package only</span>
        </label>
      </div>

      {packageDiffers && unitsPerPackage ? (
        <p className="mt-3 text-sm font-semibold">
          1 package = {unitsPerPackage} {stockLabel}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !dirty} onClick={onSave}>
          {busy ? "Saving…" : "Save packaging"}
        </Button>
        {error ? <span className="text-sm text-zenith-danger">{error}</span> : null}
        {message ? <span className="text-sm text-zenith-success">{message}</span> : null}
      </div>
    </article>
  );
}
