import { adjustInventory } from "@/actions/inventory";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function InventoryPage() {
  await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
  const [products, movements, settings] = await Promise.all([
    prisma.product.findMany({
      where: { trackInventory: true },
      orderBy: { name: "asc" },
      include: { category: true },
    }),
    prisma.inventoryMovement.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } }, performedBy: { select: { name: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const threshold = settings?.defaultReorderLevel ?? 5;
  const lowStock = products.filter((product) => product.stockQuantity <= (product.reorderLevel || threshold));
  const valuation = products.reduce((sum, product) => sum + product.stockQuantity * product.costPrice.toNumber(), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Stock control</p>
        <h1 className="text-3xl font-black">Inventory</h1>
        <p className="mt-1 text-sm text-stone-500">Menu items only appear here when stock tracking is enabled.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Tracked products</p><p className="mt-1 text-2xl font-black">{products.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Low stock</p><p className="mt-1 text-2xl font-black">{lowStock.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Stock value (cost)</p><p className="mt-1 text-2xl font-black">{formatMoney(valuation, currency)}</p></article>
      </section>
      <form action={adjustInventory} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[2fr_1fr_2fr_auto]">
        <label className="text-sm font-bold">Product
          <select required name="productId" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" disabled={!products.length}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.stockQuantity})</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">Change<input required name="quantity" type="number" placeholder="+10 or -2" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">Reason<input required name="note" minLength={3} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <button disabled={!products.length} className="min-h-11 self-end rounded-md bg-black px-5 font-bold text-[#d4af37] disabled:opacity-40">Adjust</button>
      </form>
      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Current stock</h2>
        {products.length === 0 ? (
          <p className="p-10 text-center text-stone-500">No products are currently tracking stock. Enable tracking on a product to manage inventory.</p>
        ) : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4">Qty</th>
                <th className="p-4">Reorder at</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Cost value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => {
                const low = product.stockQuantity <= product.reorderLevel;
                return (
                  <tr key={product.id} className={product.active ? "" : "opacity-50"}>
                    <td className="p-4 font-bold">{product.name}</td>
                    <td className="p-4">{product.category.name}</td>
                    <td className="p-4">{product.stockQuantity}</td>
                    <td className="p-4">{product.reorderLevel}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${low ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                        {low ? "LOW" : "OK"}
                      </span>
                    </td>
                    <td className="p-4 text-right">{formatMoney(product.stockQuantity * product.costPrice.toNumber(), currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Inventory history</h2>
        {movements.length === 0 ? (
          <p className="p-10 text-center text-stone-500">No inventory movements yet.</p>
        ) : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Product</th>
                <th className="p-4">Type</th>
                <th className="p-4">Change</th>
                <th className="p-4">Balance</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="p-4">{formatDateTime(movement.createdAt)}</td>
                  <td className="p-4 font-bold">{movement.product.name}</td>
                  <td className="p-4">{movement.type}</td>
                  <td className={`p-4 font-bold ${movement.quantity > 0 ? "text-green-700" : "text-red-700"}`}>
                    {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                  </td>
                  <td className="p-4">{movement.balanceAfter}</td>
                  <td className="p-4">{movement.performedBy.name}</td>
                  <td className="p-4">{movement.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
