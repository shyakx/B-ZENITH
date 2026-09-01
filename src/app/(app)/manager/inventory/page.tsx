import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { inventoryValuation, listMovements, listStock } from "@/services/inventory";

export default async function InventoryOverviewPage() {
  await requireRole("MANAGER");
  const [stock, movements, valuation] = await Promise.all([
    listStock(),
    listMovements(12),
    inventoryValuation(),
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

  return (
    <div>
      <PageHeader
        title="Stock Overview"
        subtitle="Buy into Main Stock, then move what you need to Bar, Kitchen, or Cafe."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Main Stock", totals.main, "Central store"],
          ["Bar", totals.bar, "Ready to sell"],
          ["Kitchen", totals.kitchen, "Kitchen use"],
          ["Cafe", totals.cafe, "Cafe use"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-zenith-border bg-white p-3">
            <div className="text-xl font-semibold text-zenith-gold">{value}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">{label}</div>
            <div className="mt-1 text-xs text-zenith-muted">{hint}</div>
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
      </div>
      <Card className="mb-4">
        <h2 className="mb-3 font-semibold">Stock</h2>
        <div className="overflow-x-auto text-sm">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2 text-right">Main</th>
                <th className="py-2 pr-2 text-right">Bar</th>
                <th className="py-2 pr-2 text-right">Kitchen</th>
                <th className="py-2 text-right">Cafe</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((product) => (
                <tr key={product.id} className="border-b border-zenith-border/70">
                  <td className="py-2 pr-2 font-semibold">{product.name}</td>
                  <td className="py-2 pr-2 text-right">{product.main}</td>
                  <td className="py-2 pr-2 text-right">{product.bar}</td>
                  <td className="py-2 pr-2 text-right">{product.kitchen}</td>
                  <td className="py-2 text-right">{product.cafe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Running low</h2>
          <div className="space-y-2 text-sm">
            {stock.filter((row) => row.total <= 5).slice(0, 12).map((product) => (
              <div key={product.id} className="flex justify-between gap-2">
                <span>{product.name}</span>
                <span className="font-semibold text-zenith-danger">{product.total}</span>
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
                <span>{move.quantity > 0 ? `+${move.quantity}` : move.quantity}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
