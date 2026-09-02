"use client";

import { useState } from "react";
import { BusinessArea, ProductType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { saveCategoryAction, saveProductAction, saveTableAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { productTypeStaffHelp, productTypeStaffLabel } from "@/lib/product-type-labels";

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
};

export function ProductForm({
  categories,
  locations,
  units,
  product,
}: {
  categories: { id: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  product?: ProductFields;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [purchaseUnitId, setPurchaseUnitId] = useState(product?.purchaseUnitId ?? product?.baseUnitId ?? "");
  const [contains, setContains] = useState(String(product?.purchaseContains ?? 1));
  const [stockUnitId, setStockUnitId] = useState(product?.baseUnitId ?? "");
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? ProductType.MENU_ITEM);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? false);
  const [sellOnPos, setSellOnPos] = useState(product?.sellOnPos ?? true);
  const isStockItem = productType === ProductType.RAW_MATERIAL;

  const purchaseUnit = units.find((unit) => unit.id === purchaseUnitId);
  const stockUnit = units.find((unit) => unit.id === stockUnitId);
  const showContains = Boolean(purchaseUnitId && stockUnitId && purchaseUnitId !== stockUnitId);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await saveProductAction({
      id: product?.id,
      name: String(formData.get("name") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
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
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
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
        <Select name="categoryId" defaultValue={product?.categoryId}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
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

      <p className="mt-2 text-sm font-semibold md:col-span-2">How do you normally buy this?</p>
      <Field label="Normally bought as">
        <Select value={purchaseUnitId} onChange={(event) => setPurchaseUnitId(event.target.value)}>
          <option value="">Choose unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Stock is counted as">
        <Select value={stockUnitId} onChange={(event) => setStockUnitId(event.target.value)}>
          <option value="">Choose unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </Field>
      {showContains ? (
        <Field label={`1 ${purchaseUnit?.name ?? "unit"} contains`}>
          <Input
            type="number"
            min={1}
            value={contains}
            onChange={(event) => setContains(event.target.value)}
          />
        </Field>
      ) : null}
      {showContains && purchaseUnit && stockUnit ? (
        <p className="rounded-lg border border-zenith-gold bg-zenith-raised px-3 py-2 text-sm font-semibold md:col-span-2">
          1 {purchaseUnit.name} = {contains || "?"} {stockUnit.name}
        </p>
      ) : null}
      {error ? <p className="text-sm text-zenith-danger md:col-span-2">{error}</p> : null}
      <Button disabled={busy} className="md:col-span-2">
        {product ? "Save product" : "Add product"}
      </Button>
    </form>
  );
}

export function CategoryForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    const result = await saveCategoryAction({
      name: String(formData.get("name") ?? ""),
      area: String(formData.get("area")) as BusinessArea,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
      <Input name="name" placeholder="Category name" required />
      <Select name="area" defaultValue="KITCHEN">
        <option value="BAR">Bar (menu group)</option>
        <option value="CAFE">Cafe (menu group)</option>
        <option value="KITCHEN">Kitchen (menu group)</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button>Add</Button>
      {error ? <p className="text-sm font-semibold text-zenith-danger md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function ProductEditor({
  categories,
  locations,
  units,
  product,
}: {
  categories: { id: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  product: ProductFields;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <Button variant="secondary" className="h-11" onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Edit"}
      </Button>
      {open ? (
        <div className="mt-3">
          <ProductForm categories={categories} locations={locations} units={units} product={product} />
        </div>
      ) : null}
    </div>
  );
}

export function CategoryRow({
  category,
}: {
  category: { id: string; name: string; area: BusinessArea };
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    const result = await saveCategoryAction({
      id: category.id,
      name: String(formData.get("name") ?? ""),
      area: String(formData.get("area")) as BusinessArea,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={onSubmit} className="mt-2 grid min-w-0 gap-2 md:grid-cols-[1fr_140px_auto]">
      <Input name="name" defaultValue={category.name} required />
      <Select name="area" defaultValue={category.area}>
        <option value="BAR">Bar (menu group)</option>
        <option value="CAFE">Cafe (menu group)</option>
        <option value="KITCHEN">Kitchen (menu group)</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button variant="secondary">Save</Button>
      {error ? <p className="text-sm font-semibold text-zenith-danger md:col-span-3">{error}</p> : null}
    </form>
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
