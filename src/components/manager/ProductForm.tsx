"use client";

import { useState } from "react";
import { BusinessArea } from "@prisma/client";
import { useRouter } from "next/navigation";
import { saveCategoryAction, saveProductAction, saveTableAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

export function ProductForm({
  categories,
  product,
}: {
  categories: { id: string; name: string }[];
  product?: {
    id: string;
    name: string;
    categoryId: string;
    sellingPrice: number;
    costPrice: number | null;
    trackInventory: boolean;
    active: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      <Field label="Name">
        <Input name="name" defaultValue={product?.name} required />
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
      <Field label="Selling price (RWF)">
        <Input name="sellingPrice" type="number" defaultValue={product?.sellingPrice ?? 0} required />
      </Field>
      <Field label="Cost price (optional)">
        <Input name="costPrice" type="number" defaultValue={product?.costPrice ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trackInventory" defaultChecked={product?.trackInventory} />
        Track inventory
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
        Active
      </label>
      {error ? <p className="text-sm text-red-300 md:col-span-2">{error}</p> : null}
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
        <option value="BAR">Bar</option>
        <option value="CAFE">Cafe</option>
        <option value="KITCHEN">Kitchen</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button>Add</Button>
      {error ? <p className="text-sm text-red-300 md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function ProductEditor({
  categories,
  product,
}: {
  categories: { id: string; name: string }[];
  product: {
    id: string;
    name: string;
    categoryId: string;
    sellingPrice: number;
    costPrice: number | null;
    trackInventory: boolean;
    active: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <Button variant="secondary" className="h-11" onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Edit"}
      </Button>
      {open ? (
        <div className="mt-3">
          <ProductForm categories={categories} product={product} />
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
        <option value="BAR">Bar</option>
        <option value="CAFE">Cafe</option>
        <option value="KITCHEN">Kitchen</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button variant="secondary">Save</Button>
      {error ? <p className="text-sm font-semibold text-zenith-danger md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function TableRow({ table }: { table: { id: string; name: string; active: boolean } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await saveTableAction({ id: table.id, name: table.name, active: !table.active });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
      <span className="font-semibold">
        {table.name} · {table.active ? "Active" : "Inactive"}
      </span>
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
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
