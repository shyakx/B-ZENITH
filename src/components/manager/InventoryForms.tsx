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
import {
  canReceiveProduct,
  isPourUnit,
  preferredStockInUnitId,
  preferredWholePackageTransferUnitId,
  quantityWithUnit,
  stockInUnitsForProduct,
  transferUnitChoicesForProduct,
  unitLabel,
} from "@/lib/domain/units";
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
  wholePackageTransfer?: boolean;
  baseUnit?: { id: string; code: string; name: string } | null;
  packs?: ProductPackOption[];
};

type LocationOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string; active: boolean };

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function confirmStockAction(input: {
  confirm: string;
  run: () => Promise<{ ok: true } | { ok: false; error: string }>;
  success: string;
  setError: (value: string) => void;
  setMessage: (value: string) => void;
  setBusy: (value: boolean) => void;
  router: { refresh: () => void };
  afterOk?: () => void;
}) {
  if (!window.confirm(input.confirm)) return;
  input.setBusy(true);
  input.setError("");
  input.setMessage("");
  try {
    const result = await input.run();
    if (!result.ok) {
      input.setError(result.error);
      return;
    }
    input.setMessage(input.success);
    input.afterOk?.();
    input.router.refresh();
  } finally {
    input.setBusy(false);
  }
}

function ActionFeedback({ error, message }: { error: string; message: string }) {
  return (
    <>
      {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-zenith-success">{message}</p> : null}
    </>
  );
}

function productOptionLabel(product: ProductOption, available?: (product: ProductOption) => number) {
  const unit = product.baseUnit ? ` · ${product.baseUnit.code}` : "";
  const qty = available ? ` (${available(product)} in Main Stock)` : "";
  return `${product.name}${unit}${qty}`;
}

function ProductSelect({
  products,
  value,
  onChange,
  available,
  groupPour = false,
}: {
  products: ProductOption[];
  value?: string;
  onChange?: (id: string) => void;
  available?: (product: ProductOption) => number;
  groupPour?: boolean;
}) {
  const kitchen = products.filter((product) => product.productType === "RAW_MATERIAL");
  const other = products.filter((product) => product.productType !== "RAW_MATERIAL");
  const pieces = products.filter((product) => isPourUnit(product.baseUnit?.code ?? ""));
  const full = products.filter((product) => !isPourUnit(product.baseUnit?.code ?? ""));
  const pourGrouped = groupPour && pieces.length > 0 && full.length > 0;
  const kitchenGrouped = !pourGrouped && kitchen.length > 0 && other.length > 0;

  return (
    <Select
      name="productId"
      required
      value={onChange ? value ?? "" : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      <option value="">Choose product</option>
      {pourGrouped ? (
        <>
          <optgroup label="Full bottles / packs">
            {full.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product, available)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pieces (shots / glasses)">
            {pieces.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product, available)}
              </option>
            ))}
          </optgroup>
        </>
      ) : kitchenGrouped ? (
        <>
          <optgroup label="Bar / packaged">
            {other.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product, available)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Stock items">
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
  initialProductId,
}: {
  products: ProductOption[];
  suppliers: SupplierOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const receivable = products.filter((row) => canReceiveProduct(row));
  const starter = receivable.find((row) => row.id === initialProductId);
  const [productId, setProductId] = useState(starter?.id ?? "");
  const [unitId, setUnitId] = useState(preferredStockInUnitId(starter));
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const product = receivable.find((row) => row.id === productId);
  const unitChoices = stockInUnitsForProduct(product);
  const selectedUnit = unitChoices.find((unit) => unit.id === unitId);
  const qty = Number(quantity);
  const received = Number.isInteger(qty) && qty > 0 && selectedUnit ? qty * selectedUnit.factor : 0;
  const paid = Number(price);
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);
  const stockName = product?.baseUnit?.name ?? "units";
  const stockCode = product?.baseUnit?.code ?? "UNIT";

  function chooseProduct(id: string) {
    setProductId(id);
    const next = receivable.find((row) => row.id === id);
    setUnitId(preferredStockInUnitId(next));
  }

  async function action(formData: FormData) {
    if (!product || !selectedUnit || !Number.isInteger(qty) || qty <= 0) {
      setError("Choose a product, package, and quantity.");
      return;
    }
    const packUnitId = selectedUnit.isPack ? selectedUnit.id : undefined;
    await confirmStockAction({
      confirm: `Receive ${quantityWithUnit(qty, selectedUnit.name)} of ${product.name} into Main Stock?`,
      success: `Received ${quantityWithUnit(received, stockCode)} of ${product.name} into Main Stock.`,
      setError,
      setMessage,
      setBusy,
      router,
      afterOk: () => {
        setQuantity("");
        setPrice("");
      },
      run: () =>
        receivePurchaseAction({
          supplierId: String(formData.get("supplierId")),
          reference: String(formData.get("reference") ?? ""),
          notes: String(formData.get("notes") ?? ""),
          idempotencyKey: newKey("receipt"),
          lines: [
            {
              productId,
              packUnitId,
              packQuantity: qty,
              packCost: price ? Number(price) : undefined,
            },
          ],
        }),
    });
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
        <ProductSelect products={receivable} value={productId} onChange={chooseProduct} />
      </Field>
      {product ? (
        <p className="text-sm text-zenith-muted">
          Main Stock: {quantityWithUnit(product.main ?? 0, stockName)} · Unit: {stockCode}
        </p>
      ) : null}
      <Field label="How many?">
        <Input
          name="quantity"
          type="number"
          min={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={!product}
        />
      </Field>
      <Field label="Package / unit">
        <Select
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          disabled={!product}
          required
        >
          <option value="">{product ? "Choose package or stock unit" : "Choose a product first"}</option>
          {unitChoices.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitLabel(unit.name)}
              {unit.isPack ? ` (= ${unit.factor} ${stockName})` : ` (stock unit)`}
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
          disabled={!product}
        />
      </Field>
      <div className="rounded-lg border border-zenith-border bg-white px-3 py-2 text-sm">
        <div className="font-semibold">Receive into: Main Stock</div>
        {received > 0 && product && selectedUnit ? (
          <div className="mt-2 space-y-1">
            <div>
              Received:{" "}
              <span className="font-semibold">
                {quantityWithUnit(qty, selectedUnit.name).toUpperCase()}
              </span>
            </div>
            <div>
              Equivalent stock:{" "}
              <span className="font-semibold">
                {quantityWithUnit(received, stockCode).toUpperCase()}
              </span>
            </div>
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
      </div>
      <Field label="Invoice / Reference">
        <Input name="reference" />
      </Field>
      <Field label="Notes">
        <Input name="notes" />
      </Field>
      <ActionFeedback error={error} message={message} />
      <Button disabled={busy || !product || !unitId || activeSuppliers.length === 0}>
        {busy ? "Receiving…" : "Receive Stock"}
      </Button>
    </form>
  );
}

export function TransferForm({
  products,
  destinations,
  initialProductId,
}: {
  products: ProductOption[];
  destinations: LocationOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const starter = products.find((row) => row.id === initialProductId);
  const [productId, setProductId] = useState(starter?.id ?? "");
  const [toId, setToId] = useState("");
  const [unitId, setUnitId] = useState(preferredWholePackageTransferUnitId(starter));
  const [quantity, setQuantity] = useState("");
  const product = products.find((row) => row.id === productId);
  const destination = destinations.find((row) => row.id === toId);
  const choices = transferUnitChoicesForProduct(product);
  const selectedUnit = choices.find((unit) => unit.id === unitId);
  const qty = Number(quantity);
  const moved = Number.isInteger(qty) && qty > 0 && selectedUnit ? qty * selectedUnit.factor : 0;
  const unitName = product?.baseUnit?.name ?? "units";
  const stockCode = product?.baseUnit?.code ?? "UNIT";
  const wholeOnly = Boolean(product?.wholePackageTransfer);

  function chooseProduct(id: string) {
    setProductId(id);
    const next = products.find((row) => row.id === id);
    setUnitId(preferredWholePackageTransferUnitId(next));
  }

  async function action(formData: FormData) {
    if (!selectedUnit || moved <= 0) return setError("Choose how many to transfer and the package.");
    if (wholeOnly && !selectedUnit.isPack) {
      return setError("This product allows whole packages only. Choose the package unit.");
    }
    if (!product || !destination) return setError("Choose a product and destination.");
    const noteParts = [
      String(formData.get("notes") ?? "").trim(),
      selectedUnit.isPack
        ? `Transferred ${quantityWithUnit(qty, selectedUnit.name)} (= ${quantityWithUnit(moved, stockCode)})`
        : `Transferred ${quantityWithUnit(moved, stockCode)}`,
    ].filter(Boolean);
    await confirmStockAction({
      confirm: `Transfer ${quantityWithUnit(qty, selectedUnit.name)} of ${product.name} from Main Stock to ${destination.name}?`,
      success: `Transferred ${quantityWithUnit(moved, stockCode)} of ${product.name} to ${destination.name}.`,
      setError,
      setMessage,
      setBusy,
      router,
      afterOk: () => setQuantity(""),
      run: () =>
        transferStockAction({
          toLocationId: String(formData.get("toLocationId")),
          notes: noteParts.join(" · "),
          idempotencyKey: newKey("transfer"),
          lines: [{ productId, baseQuantity: moved }],
        }),
    });
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="From">
        <Input value="Main Stock" disabled readOnly />
      </Field>
      <Field label="To">
        <LocationSelect locations={destinations} name="toLocationId" value={toId} onChange={setToId} />
      </Field>
      <Field label="Product">
        <ProductSelect
          products={products}
          value={productId}
          onChange={chooseProduct}
          available={(row) => row.main ?? 0}
        />
      </Field>
      {product ? (
        <p className="text-sm text-zenith-muted">
          Main Stock: {quantityWithUnit(product.main ?? 0, unitName)}
          {wholeOnly ? " · Whole package only" : ""}
          {choices.some((unit) => unit.isPack)
            ? ` · ${choices
                .filter((unit) => unit.isPack)
                .map((unit) => `1 ${unitLabel(unit.name)} = ${unit.factor} ${unitName}`)
                .join(" · ")}`
            : ""}
        </p>
      ) : null}
      {product && wholeOnly && choices.filter((unit) => unit.isPack).length === 0 ? (
        <p className="text-sm text-zenith-danger">Set packaging before transferring this product.</p>
      ) : null}
      <Field label="Quantity">
        <Input
          name="quantity"
          type="number"
          min={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={!product || choices.length === 0}
        />
      </Field>
      <Field label="Package / unit">
        <Select
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          disabled={!product || choices.length === 0}
          required
        >
          <option value="">{product ? "Choose package" : "Choose a product first"}</option>
          {choices.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitLabel(unit.name)}
              {unit.isPack ? ` (= ${unit.factor} ${unitName})` : " (stock unit)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason (optional)">
        <Input name="notes" />
      </Field>
      {product && moved > 0 && selectedUnit ? (
        <div className="rounded-lg border border-zenith-border bg-white px-3 py-2 text-sm">
          <div>
            Transfer:{" "}
            <span className="font-semibold">{quantityWithUnit(qty, selectedUnit.name).toUpperCase()}</span>
          </div>
          <div className="mt-1">
            Equivalent:{" "}
            <span className="font-semibold">{quantityWithUnit(moved, stockCode).toUpperCase()}</span>
          </div>
          {destination ? (
            <div className="mt-1 text-zenith-muted">Main Stock → {destination.name}</div>
          ) : null}
        </div>
      ) : null}
      <ActionFeedback error={error} message={message} />
      <Button disabled={busy || !product || !unitId || choices.length === 0}>
        {busy ? "Transferring…" : "Transfer Stock"}
      </Button>
    </form>
  );
}

export function WasteForm({
  products,
  locations,
  initialProductId,
}: {
  products: ProductOption[];
  locations: LocationOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const product = products.find((row) => row.id === productId);

  async function action(formData: FormData) {
    const quantity = Number(formData.get("quantity"));
    const locationId = String(formData.get("locationId"));
    const location = locations.find((row) => row.id === locationId);
    const name = product?.name ?? "this product";
    await confirmStockAction({
      confirm: `Record waste of ${quantity} ${product?.baseUnit?.code ?? "units"} of ${name} at ${location?.name ?? "this location"}?`,
      success: `Waste recorded for ${name}.`,
      setError,
      setMessage,
      setBusy,
      router,
      afterOk: () => setIdempotencyKey(crypto.randomUUID()),
      run: () =>
        recordWasteAction({
          productId: String(formData.get("productId")),
          locationId,
          quantity,
          reason: String(formData.get("reason") ?? ""),
          idempotencyKey,
        }),
    });
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="What was wasted?">
        <ProductSelect products={products} value={productId} onChange={setProductId} />
      </Field>
      <Field label="Where?">
        <LocationSelect locations={locations} />
      </Field>
      <Field label={`How many?${product?.baseUnit ? ` (${product.baseUnit.code})` : ""}`}>
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Why?">
        <Input name="reason" required />
      </Field>
      <ActionFeedback error={error} message={message} />
      <Button variant="danger" disabled={busy}>
        {busy ? "Saving…" : "Record Waste"}
      </Button>
    </form>
  );
}

export function AdjustForm({
  products,
  locations,
  initialProductId,
}: {
  products: ProductOption[];
  locations: LocationOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const product = products.find((row) => row.id === productId);

  async function action(formData: FormData) {
    const quantity = Number(formData.get("quantity"));
    const direction = String(formData.get("direction"));
    const locationId = String(formData.get("locationId"));
    const location = locations.find((row) => row.id === locationId);
    const name = product?.name ?? "this product";
    const delta = direction === "decrease" ? -quantity : quantity;
    await confirmStockAction({
      confirm: `${direction === "decrease" ? "Decrease" : "Increase"} ${name} by ${quantity} ${product?.baseUnit?.code ?? "units"} at ${location?.name ?? "this location"}?`,
      success: `Stock adjusted for ${name}.`,
      setError,
      setMessage,
      setBusy,
      router,
      afterOk: () => setIdempotencyKey(crypto.randomUUID()),
      run: () =>
        adjustStockAction({
          productId: String(formData.get("productId")),
          locationId,
          delta,
          reason: String(formData.get("reason") ?? ""),
          idempotencyKey,
        }),
    });
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Location">
        <LocationSelect locations={locations} />
      </Field>
      <Field label="Product">
        <ProductSelect products={products} value={productId} onChange={setProductId} />
      </Field>
      <Field label="Change">
        <Select name="direction" required defaultValue="increase">
          <option value="increase">Increase</option>
          <option value="decrease">Decrease</option>
        </Select>
      </Field>
      <Field label={`Quantity${product?.baseUnit ? ` (${product.baseUnit.code})` : ""}`}>
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Reason">
        <Input name="reason" required />
      </Field>
      <ActionFeedback error={error} message={message} />
      <Button variant="secondary" disabled={busy}>
        {busy ? "Saving…" : "Save Adjustment"}
      </Button>
    </form>
  );
}

export function CountForm({
  products,
  locations,
  initialProductId,
}: {
  products: ProductOption[];
  locations: LocationOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const product = products.find((row) => row.id === productId);

  async function action(formData: FormData) {
    const counted = Number(formData.get("counted"));
    const locationId = String(formData.get("locationId"));
    const location = locations.find((row) => row.id === locationId);
    const name = product?.name ?? "this product";
    await confirmStockAction({
      confirm: `Save count of ${counted} ${product?.baseUnit?.code ?? "units"} for ${name} at ${location?.name ?? "this location"}?`,
      success: `Count saved for ${name}.`,
      setError,
      setMessage,
      setBusy,
      router,
      afterOk: () => setIdempotencyKey(crypto.randomUUID()),
      run: () =>
        countStockAction({
          productId: String(formData.get("productId")),
          locationId,
          counted,
          idempotencyKey,
        }),
    });
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Where are you counting?">
        <LocationSelect locations={locations} />
      </Field>
      <Field label="Product">
        <ProductSelect products={products} value={productId} onChange={setProductId} />
      </Field>
      <Field label={`Counted${product?.baseUnit ? ` (${product.baseUnit.code})` : ""}`}>
        <Input name="counted" type="number" min={0} required />
      </Field>
      <ActionFeedback error={error} message={message} />
      <Button variant="secondary" disabled={busy}>
        {busy ? "Saving…" : "Save Count"}
      </Button>
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    await confirmStockAction({
      confirm: supplier ? `Save changes to supplier “${name}”?` : `Add supplier “${name}”?`,
      success: supplier ? "Supplier saved." : "Supplier added.",
      setError,
      setMessage,
      setBusy,
      router,
      run: () =>
        saveSupplierAction({
          id: supplier?.id,
          name,
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
    });
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
      <ActionFeedback error={error} message={message} />
      <Button disabled={busy}>{busy ? "Saving…" : supplier ? "Save supplier" : "Add supplier"}</Button>
    </form>
  );
}

export function SupplierActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    await confirmStockAction({
      confirm: active ? "Deactivate this supplier?" : "Activate this supplier?",
      success: active ? "Supplier deactivated." : "Supplier activated.",
      setError,
      setMessage,
      setBusy,
      router,
      run: () => setSupplierActiveAction({ id, active: !active }),
    });
  }

  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={toggle}>
        {busy ? "Saving…" : active ? "Deactivate" : "Activate"}
      </Button>
      <ActionFeedback error={error} message={message} />
    </div>
  );
}
