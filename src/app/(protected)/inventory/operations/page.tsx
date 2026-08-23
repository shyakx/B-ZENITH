import Link from "next/link";
import { adjustInventory } from "@/actions/inventory";
import { InventoryCountSheet } from "@/components/inventory-count-sheet";
import { PurchaseForm } from "@/components/purchase-form";
import { StockTakeForm } from "@/components/stock-take-form";
import { StockTransferForm } from "@/components/stock-transfer-form";
import { WasteForm } from "@/components/waste-form";
import { requireUser } from "@/lib/authorization";
import { DELETED_PRODUCT_SKU_PREFIX } from "@/lib/catalog-fields";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { catalogRoles } from "@/lib/roles";

const TABS = [
  { id: "receive", label: "Receive stock" },
  { id: "transfer", label: "Transfer stock" },
  { id: "count", label: "Stock count" },
  { id: "adjust", label: "Adjustment" },
  { id: "waste", label: "Waste & breakage" },
  { id: "history", label: "History" },
] as const;

export default async function InventoryOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser(catalogRoles);
  const { tab } = await searchParams;
  const active = TABS.some((item) => item.id === tab) ? tab : "receive";

  const [products, movements, suppliers, purchases, settings] = await Promise.all([
    prisma.product.findMany({
      where: { trackInventory: true, NOT: { sku: { startsWith: DELETED_PRODUCT_SKU_PREFIX } } },
      orderBy: { name: "asc" },
      include: { category: true, locationStocks: { include: { location: true } } },
    }),
    prisma.inventoryMovement.findMany({
      take: 150,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true } },
        performedBy: { select: { name: true } },
        location: { select: { code: true } },
      },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchase.findMany({
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const mapped = products.map((product) => {
    const qty = stockByLocation(product.locationStocks, [
      LOCATION_CODES.MAIN_STOCK,
      LOCATION_CODES.BAR,
      LOCATION_CODES.KITCHEN,
    ]);
    return {
      id: product.id,
      name: product.name,
      categoryName: product.category.name,
      unit: product.unit,
      costPrice: product.costPrice.toNumber(),
      quantities: qty,
      main: qty.MAIN_STOCK,
    };
  });
  const sellable = products.map((product) => ({ id: product.id, name: product.name }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Inventory</p>
        <h1 className="text-3xl font-black">Stock operations</h1>
        <p className="mt-1 text-sm text-stone-500">
          Receive from suppliers into Main Stock, then transfer to Bar or Kitchen. Count, adjust, and record waste by location. Categories are not locations.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/inventory/operations?tab=${item.id}`}
            className={`grid min-h-11 place-items-center rounded-md px-4 text-sm font-bold ${
              item.id === active ? "bg-black text-[#d4af37]" : "border bg-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {active === "receive" ? (
        <section className="space-y-4">
          <p className="text-sm text-stone-600">Supplier deliveries increase Main Stock only. Bar and Kitchen are filled by transfer after verbal approval.</p>
          {sellable.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">Add menu products before receiving stock.</p>
          ) : (
            <PurchaseForm suppliers={suppliers} products={sellable} />
          )}
          {purchases.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="p-4">Reference</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Staff</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="p-4 font-bold">
                        <Link href={`/purchases/${purchase.id}`} className="hover:underline">{purchase.referenceNumber}</Link>
                      </td>
                      <td className="p-4">{formatDateTime(purchase.createdAt)}</td>
                      <td className="p-4">{purchase.supplier?.name ?? "—"}</td>
                      <td className="p-4">{purchase._count.items}</td>
                      <td className="p-4">{purchase.createdBy.name}</td>
                      <td className="p-4 text-right font-bold">{formatMoney(purchase.total.toNumber(), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {active === "transfer" ? (
        <section className="space-y-3">
          <p className="text-sm text-stone-600">Move stock from Main Stock to Bar or Kitchen. Direct Bar ↔ Kitchen transfers are not used.</p>
          <StockTransferForm products={mapped.map((item) => ({ id: item.id, name: item.name, mainQuantity: item.main }))} />
        </section>
      ) : null}

      {active === "count" ? (
        <div className="space-y-6">
          <InventoryCountSheet
            products={mapped.map((item) => ({
              id: item.id,
              name: item.name,
              categoryName: item.categoryName,
              unit: item.unit,
              costPrice: item.costPrice,
              quantities: item.quantities,
            }))}
            currency={currency}
          />
          <StockTakeForm
            products={mapped.map((item) => ({
              id: item.id,
              name: item.name,
              stockQuantity: item.quantities.MAIN_STOCK + item.quantities.BAR + item.quantities.KITCHEN,
              unit: item.unit,
              locationQuantities: item.quantities,
            }))}
          />
        </div>
      ) : null}

      {active === "adjust" ? (
        <form action={adjustInventory} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
          <p className="text-sm text-stone-500 md:col-span-5">
            Use adjust for known corrections. Negative changes require a reason and cannot take a location below zero.
          </p>
          <label className="text-sm font-bold">
            Product
            <select required name="productId" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
              {mapped.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Location
            <select required name="locationCode" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal">
              <option value="MAIN_STOCK">Main Stock</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Kitchen</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Change
            <input required name="quantity" type="number" placeholder="+10 or -2" className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">
            Reason
            <input required name="note" minLength={3} className="mt-1 min-h-11 w-full rounded-md border px-3 font-normal" />
          </label>
          <button className="min-h-11 self-end rounded-md bg-black px-5 font-bold text-[#d4af37]">Adjust</button>
        </form>
      ) : null}

      {active === "waste" ? (
        <WasteForm products={mapped.map((item) => ({ id: item.id, name: item.name, quantities: item.quantities }))} />
      ) : null}

      {active === "history" ? (
        <section className="overflow-x-auto rounded-lg border bg-white">
          {movements.length === 0 ? (
            <p className="p-10 text-center text-stone-500">No inventory movements yet.</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Item</th>
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
                    <td className="p-4">{movement.location?.code === "MAIN_STOCK" ? "Main Stock" : movement.location?.code ?? "—"}</td>
                    <td className={`p-4 font-bold ${movement.quantity > 0 ? "text-green-700" : "text-red-700"}`}>
                      {movement.quantity > 0 ? "+" : ""}
                      {movement.quantity}
                    </td>
                    <td className="p-4">{movement.balanceAfter}</td>
                    <td className="p-4">{movement.performedBy.name}</td>
                    <td className="p-4">{movement.reason || movement.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}
