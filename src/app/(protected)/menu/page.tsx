import { ProductUnit } from "@prisma/client";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { createProduct, toggleProduct } from "@/actions/catalog";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
  const filters = await searchParams;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
        ...(filters.category ? { categoryId: filters.category } : {}),
      },
      include: { category: true, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Catalog</p><h1 className="text-3xl font-black">Menu management</h1></div>
        <Link href="/categories" className="grid min-h-11 place-items-center rounded-md border bg-white px-4 font-bold">Manage categories</Link>
      </div>
      <form className="flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        <input name="q" defaultValue={filters.q} placeholder="Search menu" className="min-h-11 flex-1 rounded-md border px-4" />
        <select name="category" defaultValue={filters.category} className="min-h-11 rounded-md border px-3">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Search</button>
      </form>
      <details className="rounded-lg border bg-white">
        <summary className="flex min-h-14 cursor-pointer items-center gap-2 p-4 font-black"><Plus size={19} /> Add menu item</summary>
        <form action={createProduct} className="grid gap-4 border-t p-5 md:grid-cols-2">
          <label className="text-sm font-bold">Name<input required name="name" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
          <label className="text-sm font-bold">SKU (optional)<input name="sku" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
          <label className="text-sm font-bold">Category<select required name="categoryId" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="text-sm font-bold">Unit<select name="unit" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">{Object.values(ProductUnit).map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label className="text-sm font-bold">Cost price<input required name="costPrice" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
          <label className="text-sm font-bold">Selling price<input required name="sellingPrice" type="number" min="0.01" step="0.01" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
          <p className="text-sm text-stone-500 md:col-span-2">
            New items start at stock 0. Enter opening quantities in Inventory with a physical stock take — do not type stock on this form.
          </p>
          <label className="text-sm font-bold">Image URL<input name="imageUrl" type="url" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
          <label className="text-sm font-bold md:col-span-2">Description<textarea name="description" rows={3} className="mt-1 w-full rounded-md border p-3 font-normal" /></label>
          <div className="flex flex-wrap gap-5 md:col-span-2">
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="trackInventory" defaultChecked /> Track inventory</label>
          </div>
          <button className="min-h-12 rounded-md bg-black px-5 font-bold text-[#d4af37] md:col-span-2">Create menu item</button>
        </form>
      </details>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="rounded-lg border bg-white p-4">
            <div className="flex justify-between gap-3">
              <div><p className="text-xs font-bold uppercase text-stone-500">{product.category.name}</p><h2 className="font-black">{product.name}</h2><p className="text-xs text-stone-500">{product.sku}</p></div>
              <span className={`h-fit rounded-full px-2 py-1 text-xs font-bold ${product.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-600"}`}>{product.active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                {product.variants.length > 1 ? (
                  product.variants.map((variant) => (
                    <p key={variant.id} className="text-sm font-black text-[#947313]">
                      {variant.name}: {variant.sellingPrice.toFixed(0)} RWF
                    </p>
                  ))
                ) : (
                  <p className="text-xl font-black text-[#947313]">{product.sellingPrice.toFixed(0)} RWF</p>
                )}
                <p className="text-sm text-stone-500">
                  {product.trackInventory
                    ? `${product.stockQuantity} ${product.unit.toLowerCase()}`
                    : "Inventory tracking disabled"}
                </p>
              </div>
              <Link href={`/menu/${product.id}`} className="grid size-11 place-items-center rounded-md border" aria-label={`Edit ${product.name}`}><Pencil size={17} /></Link>
            </div>
            <form action={toggleProduct.bind(null, product.id, !product.active)} className="mt-3"><button className="min-h-11 w-full rounded-md border font-bold">{product.active ? "Deactivate" : "Activate"}</button></form>
          </article>
        ))}
        {products.length === 0 && <p className="col-span-full rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No menu items found. Add products from the verified B-ZENITH menu.</p>}
      </section>
    </div>
  );
}
