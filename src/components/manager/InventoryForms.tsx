"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adjustStockAction,
  countStockAction,
  receivePurchaseAction,
  recordWasteAction,
} from "@/actions/inventory";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

type Product = { id: string; name: string; stockQuantity: number };

function ProductSelect({ products }: { products: Product[] }) {
  return (
    <Select name="productId" required>
      <option value="">Choose product</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name} ({product.stockQuantity})
        </option>
      ))}
    </Select>
  );
}

export function PurchaseForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await receivePurchaseAction({
      productId: String(formData.get("productId")),
      quantity: Number(formData.get("quantity")),
      unitCost: formData.get("unitCost") ? Number(formData.get("unitCost")) : undefined,
      notes: String(formData.get("notes") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="Quantity">
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Unit cost">
        <Input name="unitCost" type="number" min={0} />
      </Field>
      <Field label="Notes">
        <Input name="notes" />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button>Receive purchase</Button>
    </form>
  );
}

export function WasteForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await recordWasteAction({
      productId: String(formData.get("productId")),
      quantity: Number(formData.get("quantity")),
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="Quantity">
        <Input name="quantity" type="number" min={1} required />
      </Field>
      <Field label="Reason">
        <Input name="reason" required />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button variant="danger">Record waste</Button>
    </form>
  );
}

export function AdjustForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await adjustStockAction({
      productId: String(formData.get("productId")),
      delta: Number(formData.get("delta")),
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="Change (+/-)">
        <Input name="delta" type="number" required />
      </Field>
      <Field label="Reason">
        <Input name="reason" required />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button variant="secondary">Adjust stock</Button>
    </form>
  );
}

export function CountForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await countStockAction({
      productId: String(formData.get("productId")),
      counted: Number(formData.get("counted")),
    });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3">
      <Field label="Product">
        <ProductSelect products={products} />
      </Field>
      <Field label="Counted quantity">
        <Input name="counted" type="number" min={0} required />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button variant="secondary">Save count</Button>
    </form>
  );
}
