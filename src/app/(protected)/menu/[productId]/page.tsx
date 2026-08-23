import { ProductUnit } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProduct } from "@/actions/catalog";
import { DeleteProductButton } from "@/components/delete-product-button";
import { requireUser } from "@/lib/authorization";
import { authorizeProductDelete, canAdjustPrices, isDeletedProductSku } from "@/lib/catalog-fields";
import { catalogRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const user = await requireUser(catalogRoles);
  const { productId } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, include: { variants: { orderBy: { sortOrder: "asc" } }, sellingLocation: true } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!product || isDeletedProductSku(product.sku)) notFound();
  const canDelete = authorizeProductDelete(user.role).ok;
  const canPrice = canAdjustPrices(user.role);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><Link href="/menu" className="text-sm font-bold text-[#947313]">← Back to menu</Link><h1 className="mt-2 text-3xl font-black">Edit {product.name}</h1></div>
      <form action={updateProduct.bind(null, product.id)} className="grid gap-4 rounded-lg border bg-white p-5 md:grid-cols-2">
        <label className="text-sm font-bold">Name<input required name="name" defaultValue={product.name} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">SKU<input required name="sku" defaultValue={product.sku} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">Category<select required name="categoryId" defaultValue={product.categoryId} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm font-bold">Unit<select name="unit" defaultValue={product.unit} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">{Object.values(ProductUnit).map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        <label className="text-sm font-bold">Cost price<input required name="costPrice" type="number" min="0" step="0.01" defaultValue={product.costPrice.toFixed(2)} readOnly={!canPrice} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal read-only:bg-stone-50" /></label>
        <label className="text-sm font-bold">Selling price<input required name="sellingPrice" type="number" min="0.01" step="0.01" defaultValue={product.sellingPrice.toFixed(2)} readOnly={!canPrice} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal read-only:bg-stone-50" /></label>
        {!canPrice ? (
          <p className="text-sm text-amber-800 md:col-span-2">Only a manager can change cost or selling prices.</p>
        ) : null}
        <div className="text-sm">
          <p className="font-bold">Stock quantity</p>
          <p className="mt-1 min-h-11 rounded-md border bg-stone-50 px-3 py-3 font-normal">
            {product.trackInventory ? `${product.stockQuantity} ${product.unit.toLowerCase()}` : "Not tracked"}
          </p>
          {product.trackInventory ? (
            <Link href="/inventory#stock-take" className="mt-1 inline-block font-bold text-[#947313]">
              Change stock in Inventory
            </Link>
          ) : (
            <p className="mt-1 text-xs text-stone-500">Menu edits never change stock. Use Inventory for counted quantities.</p>
          )}
        </div>
        <label className="text-sm font-bold">Image URL<input name="imageUrl" type="url" defaultValue={product.imageUrl ?? ""} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold md:col-span-2">Description<textarea name="description" rows={4} defaultValue={product.description ?? ""} className="mt-1 w-full rounded-md border p-3 font-normal" /></label>
        <div className="flex flex-wrap gap-5 md:col-span-2">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={product.active} /> Active</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="trackInventory" defaultChecked={product.trackInventory} /> Track inventory</label>
          <label className="text-sm font-bold">POS selling location
            <select name="sellingLocationCode" defaultValue={product.sellingLocation?.code === "KITCHEN" ? "KITCHEN" : "BAR"} className="ml-2 min-h-11 rounded-md border px-3 font-normal">
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Kitchen</option>
            </select>
          </label>
        </div>
        <button className="min-h-12 rounded-md bg-black px-5 font-bold text-[#d4af37] md:col-span-2">Save changes</button>
      </form>
      {canDelete ? (
        <div className="rounded-lg border bg-white p-5">
          <DeleteProductButton productId={product.id} name={product.name} />
        </div>
      ) : null}
      {product.variants.length > 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-black">Selling units</h2>
          <div className="mt-3 divide-y">
            {product.variants.map((variant) => (
              <div key={variant.id} className="flex justify-between py-3">
                <div>
                  <b>{variant.name}</b>
                  <p className="text-xs text-stone-500">{variant.sku}</p>
                </div>
                <b className="text-[#947313]">{variant.sellingPrice.toFixed(0)} RWF</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
