"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adjustStockAction,
  countStockAction,
  receivePurchaseAction,
  recordWasteAction,
  saveSupplierAction,
  setSupplierActiveAction,
  transferStockAction,
} from "@/actions/inventory";
import { formatRwf, formatRwfPerUnit, unitCostFromTotalPrice } from "@/lib/domain/money";
import { quantityWithUnit, unitLabel } from "@/lib/domain/units";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

type ProductPackOption = {
  unitId: string;
  baseQuantity: number;
  unit: { id: string; code: string; name: string };
};

type ProductOption = {
  id: string;
  name: string;
  main?: number;
  bar?: number;
  kitchen?: number;
  cafe?: number;
  total?: number;
  productType?: string;
  baseUnit?: { id: string; code: string; name: string } | null;
  packs?: ProductPackOption[];
};

type LocationOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string; active: boolean };

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function preferredUnitId(product?: ProductOption) {
  const crate = product?.packs?.find((pack) => pack.unit.code === "CRATE");
  if (crate) return crate.unitId;
  if (product?.packs?.[0]) return product.packs[0].unitId;
  return product?.baseUnit?.id ?? "";
}

function unitsForProduct(product?: ProductOption) {
  if (!product) return [];
  const units = new Map<string, { id: string; code: string; name: string; factor: number; isPack: boolean }>();
  if (product.baseUnit) {
    units.set(product.baseUnit.id, { ...product.baseUnit, factor: 1, isPack: false });
  }
  for (const pack of product.packs ?? []) {
    units.set(pack.unitId, { ...pack.unit, factor: pack.baseQuantity, isPack: true });
  }
  return [...units.values()];
}

function productOptionLabel(product: ProductOption, available?: (product: ProductOption) => number) {
  const unit = product.baseUnit ? ` · ${unitLabel(product.baseUnit.name)}` : "";
  const qty = available ? ` (${available(product)} in Main Stock)` : "";
  return `${product.name}${unit}${qty}`;
}

function ProductSelect({
  products,
  value,
  onChange,
  available,
}: {
  products: ProductOption[];
  value?: string;
  onChange?: (id: string) => void;
  available?: (product: ProductOption) => number;
}) {
  const kitchen = products.filter((product) => product.productType === "RAW_MATERIAL");
  const other = products.filter((product) => product.productType !== "RAW_MATERIAL");
  const grouped = kitchen.length > 0 && other.length > 0;

  return (
    <Select
      name="productId"
      required
      value={onChange ? value ?? "" : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      <option value="">Choose product</option>
      {grouped ? (
        <>
          <optgroup label="Bar / packaged">
            {other.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product, available)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Kitchen stores">
            {kitchen.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product, available)}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        products.map((product) => (
          <option key={product.id} value={product.id}>
            {productOptionLabel(product, available)}
          </option>
        ))
      )}
    </Select>
  );
}

function LocationSelect({
  locations,
  name = "locationId",
  value,
  onChange,
}: {
  locations: LocationOption[];
  name?: string;
  value?: string;
  onChange?: (id: string) => void;
}) {
  return (
    <Select
      name={name}
      required
      value={onChange ? value ?? "" : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      <option value="">Choose location</option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </Select>
  );
}

export function PurchaseForm({
  products,
  suppliers,
}: {
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const product = products.find((row) => row.id === productId);
  const unitChoices = unitsForProduct(product);
  const selectedUnit = unitChoices.find((unit) => unit.id === unitId);
  const qty = Number(quantity);
  const received = Number.isInteger(qty) && qty > 0 && selectedUnit ? qty * selectedUnit.factor : 0;
  const paid = Number(price);
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);
  const stockName = product?.baseUnit?.name ?? "units";

  function chooseProduct(id: string) {
    setProductId(id);
    const next = products.find((row) => row.id === id);
    setUnitId(preferredUnitId(next));
  }

  async function action(formData: FormData) {
    const packUnitId = selectedUnit?.isPack ? selectedUnit.id : undefined;
    const result = await receivePurchaseAction({
      supplierId: String(formData.get("supplierId")),
      reference: String(formData.get("reference") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      idempotencyKey: newKey("receipt"),
      lines: [
        {
          productId,
          packUnitId,
          packQuantity: Number(quantity),
          packCost: price ? Number(price) : undefined,
        },
      ],
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Supplier">
        {activeSuppliers.length === 0 ? (
          <p className="text-sm">
            No suppliers yet. Add one under{" "}
            <a className="font-semibold text-zenith-gold" href="/manager/inventory/suppliers">
              Inventory → Suppliers
            </a>{" "}
            first.
          </p>
        ) : (
          <Select name="supplierId" required>
            <option value="">Choose supplier</option>
            {activeSuppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="What did you receive?">
        <ProductSelect products={products} value={productId} onChange={chooseProduct} />
      </Field>
      <Field label="How many?">
        <Input
          name="quantity"
          type="number"
          min={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>
      <Field label="Unit">
        <Select value={unitId} onChange={(event) => setUnitId(event.target.value)} disabled={!product}>
          <option value="">{product ? "Choose unit" : "Choose a product first"}</option>
          {unitChoices.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitLabel(unit.name)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={selectedUnit ? `Price paid for ${quantity || "?"} ${unitLabel(selectedUnit.name)}` : "Price paid"}>
        <Input
          name="pricePaid"
          type="number"
          min={1}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </Field>
      <div className="rounded-lg border border-zenith-gold bg-zenith-raised px-3 py-2 text-sm">
        <div className="font-semibold">Receive into: Main Stock</div>
        <div className="mt-1 text-zenith-muted">Everything bought from a supplier first enters Main Stock.</div>
        {received > 0 && product ? (
          <div className="mt-2 font-semibold">
            You are receiving {quantityWithUnit(received, stockName)} into Main Stock.
          </div>
        ) : null}
        {Number.isInteger(paid) && paid > 0 ? (
          <div className="mt-1">Purchase price: {formatRwf(paid)}</div>
        ) : null}
        {Number.isInteger(paid) && paid > 0 && received > 0 ? (
          <div className="mt-1 text-zenith-muted">
            Cost per {stockName}: {formatRwfPerUnit(unitCostFromTotalPrice(paid, received))}
          </div>
        ) : null}
        {selectedUnit?.isPack && qty > 0 ? (
          <div className="mt-1 text-zenith-muted">
            1 {unitLabel(selectedUnit.name)} = {selectedUnit.factor} {stockName}
          </div>
        ) : null}
      </div>
      <Field label="Invoice / Reference">
        <Input name="reference" />
      </Field>
      <Field label="Notes">
        <Input name="notes" />
      </Field>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button>Receive Stock</Button>
    </form>
  );
}

export function TransferForm({
  products,
  destinations,
}: {
  products: ProductOption[];
  destinations: LocationOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState("");
  const product = products.find((row) => row.id === productId);
  const destination = destinations.find((row) => row.id === toId);
  const qty = Number(quantity);
  const unitName = product?.baseUnit?.name ?? "units";

  async function action(formData: FormData) {
    const result = await transferStockAction({
      toLocationId: String(formData.get("toLocationId")),
      notes: String(formData.get("notes") ?? ""),
      idempotencyKey: newKey("transfer"),
      lines: [{ productId: String(formData.get("productId")), baseQuantity: Number(formData.get("quantity")) }],
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="What do you want to move?">
        <ProductSelect
          products={products}
          value={productId}
          onChange={setProductId}
          available={(row) => row.main ?? 0}
        />
      </Field>
      <div className="rounded-lg border border-zenith-gold bg-zenith-raised px-3 py-2 text-sm font-semibold">
        From: Main Stock
      </div>
      <Field label="To">
        <LocationSelect locations={destinations} name="toLocationId" value={toId} onChange={setToId} />
      </Field>
      <Field label="How many?">
        <Input
          name="quantity"
          type="number"
          min={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>
      <Field label="Reason">
        <Input name="notes" />
      </Field>
      {product && Number.isInteger(qty) && qty > 0 ? (
        <p className="text-sm font-semibold">
          Moving {quantityWithUnit(qty, unitName)} of {product.name}
          {destination ? ` · Main Stock → ${destination.name}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button>Move Stock</Button>
    </form>
  );
}

export function WasteForm({
  products,
  locations,
}: {
  products: ProductOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await recordWasteAction({
      productId: String(formData.get("productId")),
      locationId: String(formData.get("locationId")),
      quantity: Number(formData.get("quantity")),
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="What was wasted?">
        <ProductSelect products={products} />
      </Field>
      <Field label="Where?">
        <LocationSelect locations={locations} />
      </Field>
      <Field label="How many?">
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Why?">
        <Input name="reason" required />
      </Field>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button variant="danger">Record Waste</Button>
    </form>
  );
}

export function AdjustForm({
  products,
  locations,
}: {
  products: ProductOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const quantity = Number(formData.get("quantity"));
    const direction = String(formData.get("direction"));
    const result = await adjustStockAction({
      productId: String(formData.get("productId")),
      locationId: String(formData.get("locationId")),
      delta: direction === "decrease" ? -quantity : quantity,
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Location">
        <LocationSelect locations={locations} />
      </Field>
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="Change">
        <Select name="direction" required defaultValue="increase">
          <option value="increase">Increase</option>
          <option value="decrease">Decrease</option>
        </Select>
      </Field>
      <Field label="Quantity">
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Reason">
        <Input name="reason" required />
      </Field>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button variant="secondary">Save Adjustment</Button>
    </form>
  );
}

export function CountForm({
  products,
  locations,
}: {
  products: ProductOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await countStockAction({
      productId: String(formData.get("productId")),
      locationId: String(formData.get("locationId")),
      counted: Number(formData.get("counted")),
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Where are you counting?">
        <LocationSelect locations={locations} />
      </Field>
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="What did you physically count?">
        <Input name="counted" type="number" min={0} required />
      </Field>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button variant="secondary">Save Count</Button>
    </form>
  );
}

export function SupplierForm({
  supplier,
}: {
  supplier?: { id: string; name: string; phone: string | null; email: string | null; notes: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await saveSupplierAction({
      id: supplier?.id,
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    setError("");
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Name">
        <Input name="name" defaultValue={supplier?.name} required />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={supplier?.phone ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" defaultValue={supplier?.email ?? ""} />
      </Field>
      <Field label="Notes">
        <Input name="notes" defaultValue={supplier?.notes ?? ""} />
      </Field>
      {error ? <p className="text-sm text-zenith-danger">{error}</p> : null}
      <Button>{supplier ? "Save supplier" : "Add supplier"}</Button>
    </form>
  );
}

export function SupplierActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function toggle() {
    const result = await setSupplierActiveAction({ id, active: !active });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div>
      <Button variant="secondary" onClick={toggle}>
        {active ? "Deactivate" : "Activate"}
      </Button>
      {error ? <p className="mt-1 text-sm text-zenith-danger">{error}</p> : null}
    </div>
  );
}
