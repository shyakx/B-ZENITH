import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { costTimesQuantity, formatRwf } from "@/lib/domain/money";
import { PurchaseForm } from "@/components/manager/InventoryForms";
import { InventoryNav } from "@/components/manager/InventoryNav";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listReceipts, listStock } from "@/services/inventory";
import { listSuppliers } from "@/services/suppliers";

export default async function PurchasesPage() {
  await requireRole("MANAGER");
  const [receipts, stock, suppliers] = await Promise.all([
    listReceipts(30),
    listStock(),
    listSuppliers(),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <InventoryNav />
      <PageHeader
        title="Receive Stock"
        subtitle="Receive full bottles, crates, and packs into Main Stock. Move shots and glasses to Bar or Kitchen from Move Stock."
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <PurchaseForm products={stock} suppliers={suppliers} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent receipts</h2>
          <div className="space-y-3 text-sm">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-semibold">{receipt.supplier.name}</div>
                  <div className="text-zenith-muted">
                    {receipt.location.name} · {receipt.receivedBy.name} · {formatDateTime(receipt.receivedAt)}
                  </div>
                  {receipt.lines.map((line) => (
                    <div key={line.id}>
                      {line.product.name} · {line.packQuantity}
                      {line.unitCost != null
                        ? ` · ${formatRwf(costTimesQuantity(line.unitCost, line.baseQuantity))} paid`
                        : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
