import { adjustInventory } from "@/actions/inventory";
import { StockTakeForm } from "@/components/stock-take-form";
import { StockTransferForm } from "@/components/stock-transfer-form";
import { StockTakeHistoryTable } from "@/components/stock-take-history";
import { requireUser } from "@/lib/authorization";
import { DELETED_PRODUCT_SKU_PREFIX } from "@/lib/catalog-fields";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { catalogRoles } from "@/lib/roles";
import { STOCK_TAKE_ACTION } from "@/lib/stock-take";

export default async function InventoryPage() {
  await requireUser(catalogRoles);
  const [tracked, untracked, movements, stockTakes, transfers, settings] = await Promise.all([
    prisma.product.findMany({
      where: { trackInventory: true, NOT: { sku: { startsWith: DELETED_PRODUCT_SKU_PREFIX } } },
      orderBy: { name: "asc" },
      include: { category: true, locationStocks: { include: { location: true } } },
    }),
    prisma.product.findMany({
      where: { trackInventory: false, NOT: { sku: { startsWith: DELETED_PRODUCT_SKU_PREFIX } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, active: true, category: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } }, performedBy: { select: { name: true } }, location: { select: { code: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: STOCK_TAKE_ACTION },
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.stockTransfer.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        fromLocation: { select: { code: true, name: true } },
        toLocation: { select: { code: true, name: true } },
        recordedBy: { select: { name: true } },
        lines: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const threshold = settings?.defaultReorderLevel ?? 5;
  const lowStock = tracked.filter((product) => product.stockQuantity <= (product.reorderLevel || threshold));
  const valuation = tracked.reduce((sum, product) => sum + product.stockQuantity * product.costPrice.toNumber(), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Stock control</p>
        <h1 className="text-3xl font-black">Inventory</h1>
        <p className="mt-1 text-sm text-stone-500">
          Purchases enter Main Stock. Bar and Kitchen receive stock only through a recorded transfer after verbal approval. Categories stay on the menu; they are not warehouses.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Tracked inventory</p><p className="mt-1 text-2xl font-black">{tracked.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Untracked menu items</p><p className="mt-1 text-2xl font-black">{untracked.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Low stock</p><p className="mt-1 text-2xl font-black">{lowStock.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Stock value (cost)</p><p className="mt-1 text-2xl font-black">{formatMoney(valuation, currency)}</p></article>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-black">Transfer stock</h2>
          <p className="text-sm text-stone-500">Record a completed move from Main Stock to Bar or Kitchen after verbal approval. There is no pending or approval step in the system.</p>
        </div>
        <StockTransferForm
          products={tracked.map((product) => ({
            id: product.id,
            name: product.name,
            mainQuantity: stockByLocation(product.locationStocks, [LOCATION_CODES.MAIN_STOCK])[LOCATION_CODES.MAIN_STOCK],
          }))}
        />
      </section>

      <section id="stock-take" className="space-y-3">
        <div>
          <h2 className="text-xl font-black">Physical stock take</h2>
          <p className="text-sm text-stone-500">
            Select a tracked product, enter the quantity counted on the shelf, and confirm. This writes an audit record and does not change the price.
          </p>
        </div>
        <StockTakeForm
          products={tracked.map((product) => ({
            id: product.id,
            name: product.name,
            stockQuantity: product.stockQuantity,
            unit: product.unit,
            locationQuantities: stockByLocation(product.locationStocks, [LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN]),
          }))}
        />
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Tracked inventory</h2>
        {tracked.length === 0 ? (
          <p className="p-10 text-center text-stone-500">No products are currently tracking stock.</p>
        ) : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4">Main</th>
                <th className="p-4">Bar</th>
                <th className="p-4">Kitchen</th>
                <th className="p-4">Total</th>
                <th className="p-4">Reorder at</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Cost value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tracked.map((product) => {
                const qty = stockByLocation(product.locationStocks, [LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN]);
                const total = qty.MAIN_STOCK + qty.BAR + qty.KITCHEN;
                const low = total <= product.reorderLevel;
                return (
                  <tr key={product.id} className={product.active ? "" : "opacity-50"}>
                    <td className="p-4 font-bold">{product.name}</td>
                    <td className="p-4">{product.category.name}</td>
                    <td className="p-4">{qty.MAIN_STOCK}</td>
                    <td className="p-4">{qty.BAR}</td>
                    <td className="p-4">{qty.KITCHEN}</td>
                    <td className="p-4 font-bold">{total}</td>
                    <td className="p-4">{product.reorderLevel}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${low ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                        {low ? "LOW" : "OK"}
                      </span>
                    </td>
                    <td className="p-4 text-right">{formatMoney(total * product.costPrice.toNumber(), currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Untracked menu items</h2>
        {untracked.length === 0 ? (
          <p className="p-10 text-center text-stone-500">All menu items currently track inventory.</p>
        ) : (
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4">Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {untracked.map((product) => (
                <tr key={product.id} className={product.active ? "" : "opacity-50"}>
                  <td className="p-4 font-bold">{product.name}</td>
                  <td className="p-4">{product.category.name}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-stone-200 px-2 py-1 text-xs font-bold text-stone-700">
                      Inventory tracking disabled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Transfer history</h2>
        {transfers.length === 0 ? (
          <p className="p-10 text-center text-stone-500">No stock transfers recorded yet.</p>
        ) : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">From</th>
                <th className="p-4">To</th>
                <th className="p-4">Products</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="p-4">{formatDateTime(transfer.createdAt)}</td>
                  <td className="p-4">{transfer.fromLocation.name}</td>
                  <td className="p-4">{transfer.toLocation.name}</td>
                  <td className="p-4">
                    {transfer.lines.map((line) => `${line.quantity} × ${line.product.name}`).join(", ")}
                  </td>
                  <td className="p-4">{transfer.recordedBy.name}</td>
                  <td className="p-4">{transfer.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white">
        <h2 className="border-b p-4 text-xl font-black">Stock-take history</h2>
        <StockTakeHistoryTable logs={stockTakes} />
      </section>

      <form action={adjustInventory} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
        <p className="text-sm text-stone-500 md:col-span-5">
          Manual quantity adjustment is for known changes such as breakage. Choose the location. Opening stock should use the physical stock take above.
        </p>
        <label className="text-sm font-bold">Product
          <select required name="productId" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" disabled={!tracked.length}>
            {tracked.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">Location
          <select required name="locationCode" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
            <option value="MAIN_STOCK">Main Stock</option>
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Kitchen</option>
          </select>
        </label>
        <label className="text-sm font-bold">Change<input required name="quantity" type="number" placeholder="+10 or -2" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">Reason<input required name="note" minLength={3} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" /></label>
        <button disabled={!tracked.length} className="min-h-11 self-end rounded-md bg-black px-5 font-bold text-[#d4af37] disabled:opacity-40">Adjust</button>
      </form>

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
                <th className="p-4">Location</th>
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
                  <td className="p-4">{movement.location?.code ?? "MAIN_STOCK"}</td>
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
