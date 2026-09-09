"use client";

import { useState } from "react";
import { BusinessArea, ProductType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { deleteCategoryAction, deleteProductAction, previewDeleteProductAction, saveCategoryAction, saveProductAction, saveTableAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import type { SimilarNameMatch } from "@/lib/errors";
import {
  categoryAreaStaffLabel,
  categoryOptionLabel,
  productTypeStaffHelp,
  productTypeStaffLabel,
} from "@/lib/product-type-labels";

type CategoryOption = { id: string; name: string; area: BusinessArea };

type ProductFields = {
  id: string;
  name: string;
  categoryId: string;
  sellingPrice: number;
  costPrice: number | null;
  trackInventory: boolean;
  active: boolean;
  productType: ProductType;
  sellOnPos: boolean;
  baseUnitId: string | null;
  defaultStockLocationId: string | null;
  purchaseUnitId: string | null;
  purchaseContains: number | null;
  wholePackageTransfer: boolean;
};

export function ProductForm({
  categories,
  locations,
  units,
  product,
}: {
  categories: CategoryOption[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  product?: ProductFields;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [purchaseUnitId, setPurchaseUnitId] = useState(product?.purchaseUnitId ?? product?.baseUnitId ?? "");
  const [contains, setContains] = useState(String(product?.purchaseContains ?? 1));
  const [stockUnitId, setStockUnitId] = useState(product?.baseUnitId ?? "");
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? ProductType.MENU_ITEM);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? false);
  const [sellOnPos, setSellOnPos] = useState(product?.sellOnPos ?? true);
  const [wholePackageTransfer, setWholePackageTransfer] = useState(product?.wholePackageTransfer ?? false);
  const [pendingName, setPendingName] = useState("");
  const [similarMatches, setSimilarMatches] = useState<SimilarNameMatch[]>([]);
  const isStockItem = productType === ProductType.RAW_MATERIAL;

  const purchaseUnit = units.find((unit) => unit.id === purchaseUnitId);
  const stockUnit = units.find((unit) => unit.id === stockUnitId);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const showContains = Boolean(purchaseUnitId && stockUnitId && purchaseUnitId !== stockUnitId);

  async function submitProduct(formData: FormData, confirmSimilarName = false) {
    setBusy(true);
    setError("");
    setMessage("");
    if (!confirmSimilarName) setSimilarMatches([]);
    const chosenCategoryId = String(formData.get("categoryId") ?? categoryId);
    const enteredName = String(formData.get("name") ?? "");
    const result = await saveProductAction({
      id: product?.id,
      name: enteredName,
      categoryId: chosenCategoryId,
      sellingPrice: Number(formData.get("sellingPrice")),
      costPrice: formData.get("costPrice") ? Number(formData.get("costPrice")) : null,
      trackInventory: formData.get("trackInventory") === "on",
      active: formData.get("active") === "on",
      productType: String(formData.get("productType")) as ProductType,
      sellOnPos: formData.get("sellOnPos") === "on",
      baseUnitId: stockUnitId || null,
      defaultStockLocationId: String(formData.get("defaultStockLocationId") ?? "") || null,
      purchaseUnitId: purchaseUnitId || null,
      purchaseContains: showContains ? Number(contains) : 1,
      wholePackageTransfer: showContains ? wholePackageTransfer : false,
      confirmSimilarName,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.similar?.length) {
        setPendingName(enteredName.trim());
        setSimilarMatches(result.similar);
        setError("");
        return;
      }
      setSimilarMatches([]);
      setError(result.error);
      return;
    }
    setSimilarMatches([]);
    const category = categories.find((entry) => entry.id === chosenCategoryId);
    if (category) {
      setMessage(
        product
          ? `Saved in category ${category.name} (${categoryAreaStaffLabel(category.area)}).`
          : `Added to category ${category.name} (${categoryAreaStaffLabel(category.area)}).`,
      );
    }
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    await submitProduct(formData, false);
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <p className="text-sm font-semibold md:col-span-2">Product</p>
      <Field label="Name">
        <Input name="name" defaultValue={product?.name} required />
      </Field>
      <Field label="Selling price (RWF)">
        <Input name="sellingPrice" type="number" defaultValue={product?.sellingPrice ?? 0} required />
      </Field>
      <Field label="Category">
        <Select
          name="categoryId"
          value={categoryId}
          required
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="" disabled>
            Choose category (Breakfast, Drinks…)
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryOptionLabel(category)}
            </option>
          ))}
        </Select>
        {selectedCategory ? (
          <span className="mt-1 block rounded-lg border border-zenith-gold bg-zenith-raised px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zenith-gold">
            Falls under {selectedCategory.name} · {categoryAreaStaffLabel(selectedCategory.area)} menu
          </span>
        ) : (
          <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-zenith-muted">
            Pick Breakfast, Drinks, or another category so staff know where it appears.
          </span>
        )}
      </Field>
      <Field label="Product type">
        <Select
          name="productType"
          value={productType}
          onChange={(event) => setProductType(event.target.value as ProductType)}
        >
          <option value="MENU_ITEM">{productTypeStaffLabel(ProductType.MENU_ITEM)}</option>
          <option value="PACKAGED_GOOD">{productTypeStaffLabel(ProductType.PACKAGED_GOOD)}</option>
          <option value="RAW_MATERIAL">{productTypeStaffLabel(ProductType.RAW_MATERIAL)}</option>
        </Select>
        <span className="block text-xs font-normal normal-case tracking-normal text-zenith-muted">
          {productTypeStaffHelp(productType)}
        </span>
      </Field>
      <Field label="Used from">
        <Select name="defaultStockLocationId" defaultValue={product?.defaultStockLocationId ?? ""}>
          <option value="">None</option>
          {locations
            .filter((location) => location.code !== "MAIN")
            .map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
        </Select>
        <span className="block text-xs font-normal normal-case tracking-normal text-zenith-muted">
          Choose where this item is normally used.
        </span>
      </Field>
      <Field label="Cost price (optional)">
        <Input name="costPrice" type="number" step="any" defaultValue={product?.costPrice ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
        {isStockItem ? <input type="hidden" name="trackInventory" value="on" /> : null}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name={isStockItem ? undefined : "trackInventory"}
            checked={isStockItem || trackInventory}
            disabled={isStockItem}
            onChange={(event) => setTrackInventory(event.target.checked)}
          />
          Track stock
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name={isStockItem ? undefined : "sellOnPos"}
            checked={isStockItem ? false : sellOnPos}
            disabled={isStockItem}
            onChange={(event) => setSellOnPos(event.target.checked)}
          />
          Sell on POS
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
          Active
        </label>
      </div>

      <p className="mt-2 text-sm font-semibold md:col-span-2">Stock unit &amp; package</p>
      <Field label="Stock unit">
        <Select value={stockUnitId} onChange={(event) => setStockUnitId(event.target.value)}>
          <option value="">Choose unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
        <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-zenith-muted">
          How stock is counted on the shelf (Bottle, Kg, Piece…).
        </span>
      </Field>
      <Field label="Package">
        <Select value={purchaseUnitId} onChange={(event) => setPurchaseUnitId(event.target.value)}>
          <option value="">Choose package</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
        <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-zenith-muted">
          How you usually buy it (Crate, Carton, or same as stock unit).
        </span>
      </Field>
      {showContains ? (
        <Field label="Units per package">
          <Input
            type="number"
            min={1}
            value={contains}
            onChange={(event) => setContains(event.target.value)}
          />
        </Field>
      ) : null}
      {showContains && purchaseUnit && stockUnit ? (
        <p className="text-sm font-semibold md:col-span-2">
          1 {purchaseUnit.name} = {contains || "?"} {stockUnit.name}
        </p>
      ) : null}
      {showContains ? (
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={wholePackageTransfer}
            onChange={(event) => setWholePackageTransfer(event.target.checked)}
          />
          <span>
            <span className="font-semibold">Whole package only</span>
            <span className="mt-0.5 block text-xs text-zenith-muted">
              When transferring from Main Stock, allow full packages only (for example whole crates), not
              loose bottles.
            </span>
          </span>
        </label>
      ) : null}
      {similarMatches.length > 0 ? (
        <SimilarNameWarning
          className="md:col-span-2"
          kind="product"
          enteredName={pendingName}
          matches={similarMatches}
          busy={busy}
          continueLabel={product ? "Continue with this name" : "Continue creating new product"}
          onUseExisting={() => {
            setSimilarMatches([]);
            setMessage(
              `Use existing product “${similarMatches[0]?.name ?? ""}” instead of creating a duplicate.`,
            );
          }}
          onContinue={(form) => submitProduct(new FormData(form), true)}
        />
      ) : null}
      {error ? <p className="text-sm text-zenith-danger md:col-span-2">{error}</p> : null}
      {message ? <p className="text-sm text-zenith-success md:col-span-2">{message}</p> : null}
      <Button disabled={busy || !categoryId || similarMatches.length > 0} className="md:col-span-2">
        {product ? "Save product" : "Add product"}
      </Button>
    </form>
  );
}

function SimilarNameWarning({
  kind,
  enteredName,
  matches,
  busy,
  onUseExisting,
  onContinue,
  continueLabel,
  className = "",
}: {
  kind: "product" | "category";
  enteredName: string;
  matches: SimilarNameMatch[];
  busy: boolean;
  onUseExisting: () => void;
  onContinue: (form: HTMLFormElement) => void;
  continueLabel?: string;
  className?: string;
}) {
  const existing = matches[0]!;
  const label = kind === "product" ? "product" : "category";
  return (
    <div className={`space-y-2 rounded-xl border border-zenith-gold/50 bg-zenith-raised p-3 ${className}`}>
      <p className="text-sm font-semibold text-zenith-ink">Similar {label} already exists</p>
      <p className="text-sm text-zenith-muted">
        You entered: <span className="font-semibold text-zenith-ink">{enteredName}</span>
      </p>
      <p className="text-sm text-zenith-muted">
        Existing {label}: <span className="font-semibold text-zenith-ink">{existing.name}</span>
      </p>
      {matches.length > 1 ? (
        <p className="text-xs text-zenith-muted">
          Also similar: {matches.slice(1).map((row) => row.name).join(", ")}
        </p>
      ) : null}
      <p className="text-sm text-zenith-ink">Are you sure this is a different {label}?</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onUseExisting}>
          Use existing {label}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={(event) => {
            const form = event.currentTarget.closest("form");
            if (form) onContinue(form);
          }}
        >
          {continueLabel ?? `Continue creating new ${label}`}
        </Button>
      </div>
    </div>
  );
}

export function CategoryForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [similarMatches, setSimilarMatches] = useState<SimilarNameMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitCategory(formData: FormData, confirmSimilarName = false) {
    setBusy(true);
    setError("");
    if (!confirmSimilarName) {
      setSimilarMatches([]);
      setMessage("");
    }
    const enteredName = String(formData.get("name") ?? "");
    const result = await saveCategoryAction({
      name: enteredName,
      area: String(formData.get("area")) as BusinessArea,
      confirmSimilarName,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.similar?.length) {
        setPendingName(enteredName.trim());
        setSimilarMatches(result.similar);
        return;
      }
      setSimilarMatches([]);
      setError(result.error);
      return;
    }
    setSimilarMatches([]);
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    await submitCategory(formData, false);
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
      <Input name="name" placeholder="Category name (e.g. Breakfast, Drinks)" required />
      <Select name="area" defaultValue="KITCHEN">
        <option value="BAR">Bar (menu group)</option>
        <option value="CAFE">Cafe (menu group)</option>
        <option value="KITCHEN">Kitchen (menu group)</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button disabled={busy || similarMatches.length > 0}>Add</Button>
      {similarMatches.length > 0 ? (
        <SimilarNameWarning
          className="md:col-span-3"
          kind="category"
          enteredName={pendingName}
          matches={similarMatches}
          busy={busy}
          onUseExisting={() => {
            setSimilarMatches([]);
            setMessage(`Use existing category “${similarMatches[0]?.name ?? ""}” instead.`);
          }}
          onContinue={(form) => submitCategory(new FormData(form), true)}
        />
      ) : null}
      {error ? <p className="text-sm font-semibold text-zenith-danger md:col-span-3">{error}</p> : null}
      {message ? <p className="text-sm text-zenith-success md:col-span-3">{message}</p> : null}
    </form>
  );
}

function ProductDeleteControls({
  productId,
  productName,
  compact = false,
}: {
  productId: string;
  productName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [planMode, setPlanMode] = useState<"deleted" | "deactivated" | null>(null);

  async function onAskDelete() {
    setBusy(true);
    setError("");
    setMessage("");
    const preview = await previewDeleteProductAction({ id: productId });
    setBusy(false);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setPlanMessage(preview.data.message);
    setPlanMode(preview.data.mode);
    setConfirm(true);
  }

  async function onDelete() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteProductAction({ id: productId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    setConfirm(false);
    router.refresh();
  }

  if (confirm) {
    return (
      <div className={`space-y-2 rounded-xl border border-zenith-danger/40 bg-white p-3 ${compact ? "" : "mt-3"}`}>
        <p className="text-sm font-semibold">Delete {productName}?</p>
        <p className="text-xs text-zenith-muted">{planMessage}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={busy} onClick={onDelete}>
            {busy
              ? "Working…"
              : planMode === "deactivated"
                ? "Remove from active use"
                : "Delete product"}
          </Button>
        </div>
        {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={compact ? "" : "mt-3"}>
      <Button type="button" variant="danger" className="h-11" disabled={busy} onClick={onAskDelete}>
        Delete
      </Button>
      {message ? <p className="mt-2 text-sm text-zenith-success">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-zenith-danger">{error}</p> : null}
    </div>
  );
}

export function ProductEditor({
  categories,
  locations,
  units,
  product,
}: {
  categories: CategoryOption[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  product: ProductFields;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start gap-2">
        <Button variant="secondary" className="h-11" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Edit"}
        </Button>
        {!open ? (
          <ProductDeleteControls productId={product.id} productName={product.name} compact />
        ) : null}
      </div>
      {open ? (
        <div className="mt-3">
          <ProductForm categories={categories} locations={locations} units={units} product={product} />
          <ProductDeleteControls productId={product.id} productName={product.name} />
        </div>
      ) : null}
    </div>
  );
}

export function CategoryRow({
  category,
}: {
  category: { id: string; name: string; area: BusinessArea; productCount: number };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [similarMatches, setSimilarMatches] = useState<SimilarNameMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submitCategory(formData: FormData, confirmSimilarName = false) {
    setBusy(true);
    setError("");
    if (!confirmSimilarName) {
      setSimilarMatches([]);
      setMessage("");
    }
    const enteredName = String(formData.get("name") ?? "");
    const result = await saveCategoryAction({
      id: category.id,
      name: enteredName,
      area: String(formData.get("area")) as BusinessArea,
      confirmSimilarName,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.similar?.length) {
        setPendingName(enteredName.trim());
        setSimilarMatches(result.similar);
        return;
      }
      setSimilarMatches([]);
      setError(result.error);
      return;
    }
    setSimilarMatches([]);
    setEditing(false);
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    await submitCategory(formData, false);
  }

  async function onDelete() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteCategoryAction({ id: category.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }
    setMessage(result.data.message);
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="min-w-0 space-y-2">
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="h-11" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            type="button"
            variant="danger"
            className="h-11"
            disabled={busy}
            onClick={() => {
              setError("");
              setConfirmDelete(true);
            }}
          >
            Delete
          </Button>
        </div>
      ) : (
        <form action={onSubmit} className="grid min-w-0 gap-2 md:grid-cols-[1fr_140px_auto_auto]">
          <Input name="name" defaultValue={category.name} required />
          <Select name="area" defaultValue={category.area}>
            <option value="BAR">Bar (menu group)</option>
            <option value="CAFE">Cafe (menu group)</option>
            <option value="KITCHEN">Kitchen (menu group)</option>
            <option value="OTHER">Other</option>
          </Select>
          <Button variant="secondary" disabled={busy || similarMatches.length > 0}>
            Save
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {similarMatches.length > 0 ? (
            <SimilarNameWarning
              className="md:col-span-4"
              kind="category"
              enteredName={pendingName}
              matches={similarMatches}
              busy={busy}
              onUseExisting={() => {
                setSimilarMatches([]);
                setMessage(`Keep using “${similarMatches[0]?.name ?? ""}” — rename cancelled.`);
              }}
              continueLabel="Continue with this name"
              onContinue={(form) => submitCategory(new FormData(form), true)}
            />
          ) : null}
        </form>
      )}
      {confirmDelete ? (
        <div className="space-y-2 rounded-xl border border-zenith-danger/40 bg-white p-3">
          <p className="text-sm font-semibold">Delete category {category.name}?</p>
          <p className="text-xs text-zenith-muted">
            {category.productCount > 0
              ? "This category contains products and cannot be deleted yet."
              : "This category has no products and can be deleted."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            {category.productCount === 0 ? (
              <Button type="button" variant="danger" disabled={busy} onClick={onDelete}>
                {busy ? "Deleting…" : "Delete category"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
      {message ? <p className="text-sm text-zenith-success">{message}</p> : null}
    </div>
  );
}

export function TableRow({
  table,
  showLabel = true,
}: {
  table: { id: string; name: string; active: boolean };
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await saveTableAction({ id: table.id, name: table.name, active: !table.active });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      {showLabel ? (
        <span className="font-semibold">
          {table.name} · {table.active ? "Active" : "Inactive"}
        </span>
      ) : null}
      <Button variant="secondary" className="h-11" disabled={busy} onClick={toggle}>
        {table.active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

export function TableForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    const result = await saveTableAction({
      name: String(formData.get("name") ?? ""),
      active: true,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex gap-3">
      <Input name="name" placeholder="Table name or number" required />
      <Button>Add table</Button>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
    </form>
  );
}
