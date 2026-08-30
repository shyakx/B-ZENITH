import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { AdjustForm, CountForm, PurchaseForm, WasteForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listMovements, listStock } from "@/services/inventory";

export default async function InventoryPage() {
  await requireRole("MANAGER");
  const [stock, movements] = await Promise.all([listStock(), listMovements()]);
  const options = stock.map((product) => ({
    id: product.id,
    name: product.name,
    stockQuantity: product.stockQuantity,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <PageHeader title="Inventory" subtitle="Stock in, stock out, with a reason and a name on every change." />
      <div className="mb-6 grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="mb-3 font-semibold">Receive purchase</h2>
          <PurchaseForm products={options} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Waste</h2>
          <WasteForm products={options} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Adjustment</h2>
          <AdjustForm products={options} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Stock count</h2>
          <CountForm products={options} />
        </Card>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Current stock</h2>
          <div className="space-y-2 text-sm">
            {stock.map((product) => (
              <div key={product.id} className="flex justify-between">
                <span>
                  {product.name}{" "}
                  <span className="text-zenith-muted">· {product.category.name}</span>
                </span>
                <span className={product.stockQuantity <= 5 ? "text-red-300" : "text-zenith-gold"}>
                  {product.stockQuantity}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Movements</h2>
          <div className="space-y-2 text-sm">
            {movements.map((move) => (
              <div key={move.id} className="flex justify-between gap-3">
                <span>
                  {move.product.name} · {move.type} · {move.user.name}
                  <div className="text-xs text-zenith-muted">{formatDateTime(move.createdAt)}</div>
                </span>
                <span>{move.quantity > 0 ? `+${move.quantity}` : move.quantity}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
