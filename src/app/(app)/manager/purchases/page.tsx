import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PurchaseForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listPurchases, listStock } from "@/services/inventory";

export default async function PurchasesPage() {
  await requireRole("MANAGER");
  const [purchases, stock] = await Promise.all([listPurchases(), listStock()]);

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Receiving stock increases inventory immediately." />
      <div className="mb-6 max-w-md">
        <Card>
          <PurchaseForm
            products={stock.map((product) => ({
              id: product.id,
              name: product.name,
              stockQuantity: product.stockQuantity,
            }))}
          />
        </Card>
      </div>
      <div className="space-y-3">
        {purchases.map((purchase) => (
          <div
            key={purchase.id}
            className="flex flex-wrap justify-between gap-3 rounded-2xl border border-zenith-border bg-zenith-card p-4"
          >
            <div>
              <div className="font-semibold">{purchase.product.name}</div>
              <div className="text-sm text-zenith-muted">
                {purchase.user.name} · {formatDateTime(purchase.createdAt)}
              </div>
            </div>
            <div>
              +{purchase.quantity}
              {purchase.unitCost ? ` · ${formatRwf(purchase.unitCost)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
