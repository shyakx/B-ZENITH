import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { formatStockQty } from "@/lib/domain/units";
import { EnsureKitchenStoresButton } from "@/components/manager/EnsureKitchenStoresButton";
import { InventoryStockLists } from "@/components/manager/InventoryStockLists";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { inventoryValuation, listMovements, listStock } from "@/services/inventory";
import { kitchenStoresStatus } from "@/services/products";

export default async function InventoryOverviewPage() {
  await requireRole("MANAGER");
  const [stock, movements, valuation, kitchen] = await Promise.all([
    listStock(),
    listMovements(12),
    inventoryValuation(),
    kitchenStoresStatus(),
  ]);
  const totals = stock.reduce(
    (sum, row) => ({
      main: sum.main + row.main,
      bar: sum.bar + row.bar,
      kitchen: sum.kitchen + row.kitchen,
      cafe: sum.cafe + row.cafe,
    }),
    { main: 0, bar: 0, kitchen: 0, cafe: 0 },
  );
  const packaged = stock.filter((row) => row.productType !== "RAW_MATERIAL");
  const materials = stock.filter((row) => row.productType === "RAW_MATERIAL");

  return (
    <div>
      <PageHeader
        title="Stock Overview"
        subtitle="Buy into Main Stock, then move drinks to Bar and kitchen stores to Kitchen. Quantities always show the official stock unit."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Main Stock", totals.main, "Central store"],
          ["Bar", totals.bar, "Ready to sell"],
          ["Kitchen", totals.kitchen, "Kitchen use"],
          ["Cafe", totals.cafe, "Cafe use"],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-zenith-border bg-white p-3">
            <div className="text-xl font-semibold text-zenith-gold">{value as number}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">{label as string}</div>
            <div className="mt-1 text-xs text-zenith-muted">{hint as string}</div>
          </div>
        ))}
      </div>
      <p className="mb-4 text-sm">Stock value: {formatRwf(valuation.total)}</p>
      <div className="mb-4 flex flex-wrap gap-2 text-sm font-semibold">
        <Link className="rounded-lg bg-zenith-gold px-3 py-1.5 text-white" href="/manager/purchases">
          Receive Stock
        </Link>
        <Link className="rounded-lg border border-zenith-gold px-3 py-1.5 text-zenith-gold" href="/manager/inventory/transfer">
          Move Stock
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/locations">
          Stock by Location
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/product-names">
          Product Names & Units
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/movements">
          Stock Movements
        </Link>
      </div>
      {kitchen.missing.length > 0 ? (
        <div className="mb-4">
          <EnsureKitchenStoresButton missing={kitchen.missing.length} />
        </div>
      ) : null}
      <InventoryStockLists materials={materials} packaged={packaged} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Running low</h2>
          <div className="space-y-2 text-sm">
            {stock.filter((row) => row.total <= 5).slice(0, 12).map((product) => (
              <div key={product.id} className="flex justify-between gap-2">
                <span>
                  {product.name}
                  {product.managerReferenceName ? (
                    <span className="text-zenith-muted"> · {product.managerReferenceName}</span>
                  ) : null}
                </span>
                <span className="font-semibold text-zenith-danger">
                  {formatStockQty(product.total, product.baseUnit?.code)}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent changes</h2>
          <div className="space-y-2 text-sm">
            {movements.map((move) => (
              <div key={move.id} className="flex justify-between gap-2">
                <span>
                  {move.product.name}
                  {move.location ? ` · ${move.location.name}` : ""}
                </span>
                <span className="font-semibold">
                  {move.quantity > 0 ? "+" : ""}
                  {formatStockQty(move.quantity, move.product.baseUnit?.code)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
